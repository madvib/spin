/**
 * The client a browser dials.
 *
 * The daemon's procedures are the server's: they read the disk, they run
 * the lints, they write files. A browser needs the address and the shape
 * of the answers — not the procedures themselves — so the client lives in
 * its own entry, and a bundle that carries only the client carries none of
 * the server with it.
 *
 * The router's TYPE is the one thing that crosses: the client is typed by
 * the procedures it calls, so a procedure that changes its answer changes
 * the client's type with it. The type is erased at build time, and the
 * browser never sees the router.
 */

import { RPCLink } from "@orpc/client/fetch";
import { createORPCClient } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import type { router } from "./index.ts";

/** Typed client over a fetch link. The studio and CLI use this, never raw fetch. */
export type SpinClient = RouterClient<typeof router>;

export function createSpinClient(url: string): SpinClient {
  const link = new RPCLink({ url });
  return createORPCClient(link);
}
