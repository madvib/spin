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

export { themeRouter } from "@spin/theme";
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
