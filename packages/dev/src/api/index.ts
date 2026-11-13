/**
 * @spinjs/api — transport for module-owned procedures.
 *
 * Each module owns its contract and its handler (`themeContract` /
 * `themeRouter` live in `@spinjs/theme` because the theme implements them;
 * `projectContract` lives here because the wire shape of a project is the
 * daemon's, while the operations over one live in `@spinjs/project`).
 * This package owns nothing procedural: it mounts routers on handlers,
 * builds the typed client the studio and CLI use, and names the daemon's
 * single router. Transport, not definition.
 */

import { RPCLink } from "@orpc/client/fetch";
import { createORPCClient } from "@orpc/client";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { createSpinClient, type SpinClient } from "./client.ts";
import { setProjectRoot } from "@spinjs/server/procedures";
import { OVERLAY_SCRIPT } from "@spinjs/server";
import { themeRouter } from "@spinjs/theme";
import { presetRouter } from "@spinjs/preset";
import { overlayRouter } from "@spinjs/server/procedures";
import { projectRouter } from "@spinjs/server/procedures";
import { previewRouter } from "./preview-procedures.ts";
import { fontsRouter } from "@spinjs/server/procedures";
import { iconsRouter } from "@spinjs/server/procedures";
import { issuesRouter } from "@spinjs/server/procedures";
import { findingsRouter } from "./findings-procedures.ts";
import { componentsRouter } from "./components-procedures.ts";

export { themeRouter } from "@spinjs/theme";
export { projectRouter, setProjectRoot } from "@spinjs/server/procedures";
export { previewRouter } from "./preview-procedures.ts";
export { previewContract } from "./preview-procedures.ts";
export { projectContract } from "@spinjs/server/procedures";
export { themeContract } from "@spinjs/theme";

export { presetContract, presetRouter } from "@spinjs/preset";
export { overlayContract, overlayRouter } from "@spinjs/server/procedures";
export { componentsRouter } from "./components-procedures.ts";
export { componentsContract } from "./components-contract.ts";
export { fontsContract, fontsRouter } from "@spinjs/server/procedures";
export { iconsContract, iconsRouter } from "@spinjs/server/procedures";
export { issuesContract, issuesRouter } from "@spinjs/server/procedures";
export { findingsContract, findingsRouter } from "./findings-procedures.ts";
export { createSpinClient, type SpinClient } from "./client.ts";

/**
 * A client that calls the procedures in-process, against a project root.
 *
 * The CLI and `spin mcp` run beside the project they act on: no daemon, no
 * port, no second process. The router handles the call through the same
 * handler the daemon serves, with the project root set for this call.
 */
export function createInProcessSpinClient(root?: string): SpinClient {
  if (root !== undefined) setProjectRoot(root);
  const link = new RPCLink({
    url: "http://localhost/rpc",
    fetch: async (req: Request, init: RequestInit) =>
      (await handleApiRequest(new Request(req, init), { prefix: "/rpc" }))
        .response,
  });
  return createORPCClient(link);
}

/**
 * The client the CLI dials: a daemon URL when one is named, in-process
 * otherwise. `--url` wins, then `SPIN_URL` / `SPIN_DAEMON_URL`, then the
 * local project root — so a bare command never needs a server.
 */
export function resolveSpinClient(
  options?: { url?: string; root?: string },
): SpinClient {
  const url = options?.url ?? process.env["SPIN_URL"] ??
    process.env["SPIN_DAEMON_URL"];
  if (url !== undefined) return createSpinClient(url);
  return createInProcessSpinClient(options?.root ?? process.cwd());
}

/** The daemon's router: every module's procedures, mounted by name. */
export const router = {
  ...themeRouter,
  ...presetRouter,
  ...projectRouter,
  ...componentsRouter,
  ...previewRouter,
  ...overlayRouter,
  ...fontsRouter,
  ...iconsRouter,
  ...issuesRouter,
  ...findingsRouter,
};

export const rpcHandler = new RPCHandler(router);

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
export function mountSpinApp(
  root: string,
  options?: { studioDir?: string },
): (
  host: { server: unknown; root: string },
) => void {
  const resolveRoot = (fallback: string): string => root || fallback;
  return ({ server, root: fallback }) => {
    const app = createSpinApp({
      root: resolveRoot(fallback),
      ...(options?.studioDir === undefined
        ? {}
        : { studioDir: options.studioDir }),
    });
    const middlewares = (server as MiddlewareHost).middlewares;
    middlewares.use((req, res, next) => {
      const url = req.url ?? "/";
      if (!url.startsWith("/__spin")) return next();
      void (async () => {
        const parts: BlobPart[] = [];
        for await (const chunk of req) parts.push(chunk as BlobPart);
        const request = new Request(new URL(url, "http://localhost"), {
          method: req.method ?? "GET",
          headers: req.headers as unknown as HeadersInit,
          ...(req.method !== "GET" && req.method !== "HEAD" && parts.length > 0
            ? { body: new Blob(parts) }
            : {}),
        });
        const response = await app.fetch(request);
        res.statusCode = response.status;
        response.headers.forEach((value: string, name: string) =>
          res.setHeader(name, value)
        );
        res.end(new Uint8Array(await response.arrayBuffer()));
      })().catch((error: unknown) => {
        // The mount swallows what the app throws: name the procedure path
        // and the message server-side, so a 500 in the browser has a cause
        // in the dev log instead of a silent empty body.
        console.error(`[spin] ${url} failed:`, error instanceof Error ? error.message : error);
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
   * The studio's built bundle, served beside the procedures. Defaults to
   * the shipped bundle — `packages/dev/dist/studio` in a published
   * install, `apps/studio/dist` in this checkout — and absent when neither
   * is built, where the mount skips it rather than failing the server.
   */
  readonly studioDir?: string;
}

/**
 * The studio's built bundle, when one is present.
 *
 * A published install carries it beside the procedures
 * (`packages/dev/dist/studio`); this checkout builds it at
 * `apps/studio/dist`. Either path with an `index.html` wins — an explicit
 * `studioDir` still overrides both.
 */
export function defaultStudioDir(): string | undefined {
  // Sync on purpose: `createSpinApp` builds the Hono app inline, and the
  // probe is two existence checks on paths that are usually absent. An
  // async default would push asynchrony into every dev-server mount.
  const { existsSync } = process.getBuiltinModule("node:fs");
  const { dirname, join } = process.getBuiltinModule("node:path");
  const { fileURLToPath } = process.getBuiltinModule("node:url");
  const { createRequire } = process.getBuiltinModule("node:module");
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates: string[] = [
    // A published install carries the bundle beside the procedures.
    join(here, "..", "studio"),
  ];
  // This checkout builds the studio beside the packages, not inside them.
  // The workspace root is the first ancestor whose manifest declares
  // workspaces — found by walking package boundaries, not by counting
  // directory levels.
  try {
    let dir = dirname(createRequire(import.meta.url).resolve("@spinjs/dev/package.json"));
    for (let depth = 0; depth < 6; depth++) {
      candidates.push(join(dir, "apps/studio/dist"));
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // No workspace root found: the published bundle stands alone.
  }
  for (const candidate of candidates) {
    try {
      if (existsSync(join(candidate, "index.html"))) return candidate;
    } catch {
      // Missing bundle: try the next candidate.
    }
  }
  return undefined;
}

/**
 * The app a dev server mounts: every procedure under the base path, the
 * studio bundle beside it when one is built.
 *
 * One Hono app, every host — the standalone daemon mounts this same app,
 * so dev and `spin studio` never drift. No CORS: the app, the API, and the
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
    `${sideRoot}/overlay.js`,
    (c) => c.body(OVERLAY_SCRIPT, 200, { "content-type": "text/javascript" }),
  );
  // The studio bundle, when one is built. Served beside the procedures so
  // the tool and the API it talks to are one origin by construction. An
  // explicit `studioDir` wins; otherwise the shipped bundle (or this
  // checkout's) serves when present, and the mount skips it when absent.
  const studioDir = options.studioDir ?? defaultStudioDir();
  if (studioDir !== undefined) {
    const dir = studioDir;
    const prefix = `${sideRoot}/studio`;
    // Relative assets in the bundle resolve against the index URL. Without
    // the trailing slash they resolve one level too high.
    outer.get(prefix, (c) => c.redirect(`${prefix}/`));
    outer.use(`${prefix}/*`, async (c, next) => {
      // Directories fall through to the index fallback below: hono's
      // serveStatic neither returns nor calls `next()` for a directory
      // path, which hangs the chain with an unfinalized context.
      // `c.req.path` is the route-relative path inside the mount, so
      // compare against the file tail rather than the full URL.
      const tail = c.req.path.split("/").pop() ?? "";
      if (tail === "" || !tail.includes(".")) return next();
      // Served directly, not through hono's serveStatic: on a miss it
      // neither returns nor calls `next()`, which hangs the chain with an
      // unfinalized context instead of falling through to the index
      // fallback below. A miss here is a fallthrough, not a failure.
      const { readFile, stat } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const rel = c.req.path.replace(prefix, "");
      try {
        const probe = await stat(join(dir, rel));
        if (!probe.isFile()) return next();
        const body = await readFile(join(dir, rel));
        const mime = rel.endsWith(".js")
          ? "text/javascript"
          : rel.endsWith(".css")
          ? "text/css"
          : rel.endsWith(".html")
          ? "text/html"
          : rel.endsWith(".json")
          ? "application/json"
          : rel.endsWith(".svg")
          ? "image/svg+xml"
          : "application/octet-stream";
        return c.body(body, 200, { "content-type": mime });
      } catch {
        return next();
      }
    });
    // The bundle is one page: every studio route serves the same entry,
    // and the client router takes it from there. Read directly — the
    // middleware form with an overridden path never finalizes the context.
    // The entry's asset references are relative (`./assets/…`), which a
    // nested route (`/themes/type`) would resolve against itself; rewrite
    // them to the mount-absolute prefix, which resolves from anywhere.
    outer.get(`${prefix}/*`, async (c) => {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      try {
        const html = await readFile(join(dir, "index.html"), "utf8");
        return c.html(html.replaceAll("./assets/", `${prefix}/assets/`));
      } catch {
        return c.notFound();
      }
    });
  }
  return outer;
}
