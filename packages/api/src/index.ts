/**
 * @spin/api — transport for module-owned procedures.
 *
 * Each module owns its contract and its handler (`themeContract` /
 * `themeRouter` live in `@spin/theme` because the theme implements them).
 * This package owns nothing procedural: it mounts routers on handlers,
 * builds the typed client the studio and CLI use, and names the daemon's
 * single router. Transport, not definition.
 */

import { RPCHandler } from "@orpc/server/fetch";
import type { RouterClient } from "@orpc/server";
import { RPCLink } from "@orpc/client/fetch";
import { createORPCClient } from "@orpc/client";
import { Hono } from "hono";
import { setProjectRoot } from "./project-procedures.ts";
import { themeRouter } from "@spin/theme";
import { primitivesRouter } from "../../preset/src/primitives-procedures.ts";
import { presetRouter } from "@spin/preset";
import { projectRouter } from "./project-procedures.ts";
import { previewRouter } from "./preview-procedures.ts";
import { overlayRouter } from "@spin/preset";

export { themeRouter } from "@spin/theme";
export { projectRouter, setProjectRoot } from "./project-procedures.ts";
export { previewRouter } from "./preview-procedures.ts";
export { previewContract } from "./preview-procedures.ts";
export {
  initFiles,
  isWired,
  PROJECT_DIR,
  projectContract,
} from "./project-contract.ts";
export { themeContract } from "@spin/theme";
export { primitivesRouter } from "../../preset/src/primitives-procedures.ts";
export { primitivesContract } from "../../preset/src/primitives-procedures.ts";
export { presetRouter } from "@spin/preset";
export { presetContract } from "@spin/preset";

/** The daemon's router: every module's procedures, mounted by name. */
export const router = {
  ...themeRouter,
  ...primitivesRouter,
  ...presetRouter,
  ...projectRouter,
  ...previewRouter,
  ...overlayRouter,
};

export const rpcHandler = new RPCHandler(router);

/** Typed client over a fetch link. The studio and CLI use this, never raw fetch. */
export type SpinClient = RouterClient<typeof router>;

export function createSpinClient(url: string): SpinClient {
  const link = new RPCLink({ url });
  return createORPCClient(link);
}

/**
 * Mount the router on a Fetch-API host (Deno.serve, vent, Hono via the fetch
 * adapter). Returns `matched: false` when no procedure claims the request and
 * the host should fall through.
 */
export async function handleApiRequest(
  request: Request,
  options?: { prefix?: `/${string}`; context?: unknown },
): Promise<{ matched: boolean; response: Response }> {
  const { matched, response } = await rpcHandler.handle(request, {
    prefix: options?.prefix ?? "/rpc",
    ...(options?.context !== undefined
      ? { context: options.context as never }
      : {}),
  });
  if (matched) return { matched: true, response };
  return {
    matched: false,
    response: new Response("Not Found", { status: 404 }),
  };
}

/** The part of a dev server that mounts middleware. */
export interface MiddlewareHost {
  middlewares: {
    use: (handler: {
      (req: ServerRequest, res: ServerResponse, next: () => void): void;
    }) => void;
  };
}

interface ServerRequest {
  url?: string;
  method?: string;
  headers: Record<string, unknown>;
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
}

interface ServerResponse {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: Uint8Array) => void;
}

/**
 * Mount the app on a dev server's middleware stack.
 *
 * Curried on the project root so the app config reads as one line:
 * `mount: mountSpinApp(root)`. The returned host matches the plugin's
 * `mount` option. Same origin, so no CORS handlers: the split that needed
 * them — studio on one port, daemon on another — is gone.
 */
export function mountSpinApp(root: string): (
  host: { server: unknown; root: string },
) => void {
  const resolveRoot = (fallback: string): string => root || fallback;
  return ({ server, root: fallback }) => {
    const app = createSpinApp({ root: resolveRoot(fallback) });
    const middlewares = (server as MiddlewareHost).middlewares;
    middlewares.use((req, res, next) => {
      const url = req.url ?? "/";
      if (!url.startsWith("/__spin")) return next();
      void (async () => {
        const parts: BlobPart[] = [];
        for await (const chunk of req) parts.push(chunk as BlobPart);
        const request = new Request(new URL(url, "http://localhost"), {
          method: req.method,
          headers: req.headers as unknown as HeadersInit,
          ...(req.method !== "GET" && req.method !== "HEAD"
            ? { body: parts.length ? new Blob(parts) : undefined }
            : {}),
        });
        const response = await app.fetch(request);
        res.statusCode = response.status;
        response.headers.forEach((value: string, name: string) =>
          res.setHeader(name, value)
        );
        res.end(new Uint8Array(await response.arrayBuffer()));
      })().catch(() => {
        res.statusCode = 500;
        res.end();
      });
    });
  };
}

/** Options for the app the dev server mounts. */
export interface SpinAppOptions {
  /** The project root the filesystem procedures serve. */
  readonly root: string;
  /** Where the procedures live. `/__spin/rpc` in dev, `/rpc` standalone. */
  readonly base?: `/${string}`;
  /**
   * The studio's built bundle, served beside the procedures. Absent in
   * development, where the studio runs on its own server.
   */
  readonly studioDir?: string;
}

/**
 * The app a dev server mounts: every procedure under the base path, the
 * studio bundle beside it when one is built.
 *
 * One Hono app, every host — the standalone daemon mounts this same app,
 * so dev and `spin daemon` never drift. No CORS: the app, the API, and the
 * studio are one origin, and the handlers that echoed loopback origins are
 * gone with the split.
 */
export function createSpinApp(options: SpinAppOptions): Hono {
  // The base IS the RPC mount path: `/__spin/rpc` in dev, `/rpc`
  // standalone. One string, so the app and the client that dials it can
  // never disagree about where the procedures live.
  const base = options.base ?? "/__spin/rpc";
  setProjectRoot(options.root);
  // No `basePath` here: the outer app routes this app at `base`, and
  // composing the two would prefix every procedure twice.
  const app = new Hono();
  // Cross-origin, loopback only: standalone studio-dev POSTs the overlay
  // from a second server on another port. Mounted, everything is one
  // origin and this never fires. A wildcard would let any page call
  // procedures that write to disk; the browser is the only client that
  // sends a forged Origin it does not own, and loopback is this machine.
  app.use("/*", async (c, next) => {
    await next();
    const origin = c.req.header("origin") ?? "";
    if (origin === "") return;
    try {
      const { hostname } = new URL(origin);
      if (
        hostname === "localhost" || hostname === "127.0.0.1" ||
        hostname === "::1" || hostname === "[::1]"
      ) {
        c.res.headers.set("access-control-allow-origin", origin);
        c.res.headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
        c.res.headers.set("access-control-allow-headers", "content-type");
      }
    } catch {
      // Not a URL, not our caller.
    }
  });
  app.options("/*", (c) => c.body(null, 204));
  app.all("/*", async (c) => {
    const { matched, response } = await rpcHandler.handle(c.req.raw, {
      prefix: base,
    });
    return matched ? response : c.notFound();
  });
  // Everything beside the procedures lives on the outer app, because
  // `basePath` prefixes every route of the inner one: the badge and the
  // studio bundle sit next to the RPC mount, not under it.
  const outer = new Hono();
  outer.route(base, app);
  const sideRoot = base.replace(/\/rpc$/, "");
  // The unsaved-changes badge the plugin injects into the user's app in
  // dev. A static module, not a procedure: it polls `overlay.get` and
  // toggles a fixed-position tag, so unsaved work is visible outside the
  // studio. Served from here so the badge and the state it reads are one
  // origin by construction.
  outer.get(
    `${sideRoot}/badge.js`,
    (c) => c.body(BADGE_JS, 200, { "content-type": "text/javascript" }),
  );
  // The studio bundle, if one was built. Served beside the procedures so
  // the tool and the API it talks to are one origin by construction.
  if (options.studioDir !== undefined) {
    const dir = options.studioDir;
    outer.use(`${sideRoot}/studio/*`, async (c, next) => {
      const { serveStatic } = await import("hono/deno");
      await serveStatic({ root: dir })(c, next);
    });
  }
  return outer;
}

/**
 * The badge: polls the overlay state and shows a tag while any theme
 * differs from disk. Unstyled by the project on purpose — fixed position,
 * system font, high contrast — so a broken theme cannot hide the signal
 * that would recover it.
 */
const BADGE_JS = `export function spinUnsavedBadge(base = "/__spin/rpc") {
  const tag = document.createElement("a");
  tag.href = base.replace(/\\/rpc$/, "/studio");
  tag.target = "_blank";
  tag.rel = "noopener";
  tag.textContent = "Unsaved theme changes";
  tag.style.cssText = "position:fixed;bottom:12px;right:12px;z-index:2147483647;"
    + "display:none;background:#b91c1c;color:#fff;font:600 13px/1.4 system-ui,sans-serif;"
    + "padding:8px 12px;border-radius:8px;text-decoration:none;"
    + "box-shadow:0 2px 8px rgba(0,0,0,.35);";
  document.body.appendChild(tag);
  async function poll() {
    try {
      const res = await fetch(base + "/overlay/get", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = await res.json();
      const dirty = body?.json?.dirty ?? [];
      tag.style.display = dirty.length > 0 ? "block" : "none";
      if (dirty.length > 0) {
        tag.textContent =
          "Unsaved theme changes: " + dirty.join(", ");
      }
    } catch {
      // The API is unreachable; the badge stays hidden rather than
      // crying wolf about state it cannot read.
    }
    setTimeout(poll, 2000);
  }
  poll();
}
`;
