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
 * Mount the daemon's router on a dev server.
 *
 * This is what makes the studio, the API, and the app one process. The
 * plugin cannot import this package — dependencies point the other way —
 * so the plugin takes a `mount` and the app that wants both passes this.
 */
export function mountSpinApi(
  server: MiddlewareHost,
  options?: { prefix?: `/${string}` },
): void {
  const prefix = options?.prefix ?? "/rpc";
  server.middlewares.use((req, res, next) => {
    const url = req.url ?? "/";
    if (!url.startsWith(prefix)) return next();
    void (async () => {
      const parts: BlobPart[] = [];
      for await (const chunk of req) parts.push(chunk as BlobPart);
      const request = new Request(new URL(url, "http://localhost"), {
        method: req.method,
        headers: req.headers as HeadersInit,
        ...(req.method !== "GET" && req.method !== "HEAD"
          ? { body: parts.length ? new Blob(parts) : undefined }
          : {}),
      });
      const { response } = await handleApiRequest(request, { prefix });
      res.statusCode = response.status;
      response.headers.forEach((value, name) => res.setHeader(name, value));
      res.end(new Uint8Array(await response.arrayBuffer()));
    })().catch(() => {
      res.statusCode = 500;
      res.end();
    });
  });
}
