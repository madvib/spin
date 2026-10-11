/**
 * The daemon client the studio talks to.
 *
 * One address, decided once: the daemon the studio was started against. The
 * studio never imports the domain for theme documents — `theme.text` arrives
 * over RPC, gets edited as text, and goes back over RPC. Tokens, preview CSS,
 * and validation all stay on the daemon side of this file.
 */

import { createSpinClient, type SpinClient } from "@spin/api";

/**
 * Where the daemon listens in development. The studio and the daemon are
 * started together (`spin daemon` on its port, `vite dev` on its own); the
 * address is a constant, not configuration, because there is exactly one
 * daemon per project and discovering it would be machinery for a problem
 * that does not exist.
 */
export const DAEMON_URL = "http://localhost:7463/rpc";

let client: SpinClient | undefined;

/** The typed client, built once and shared. */
export function spinClient(): SpinClient {
  if (client === undefined) client = createSpinClient(DAEMON_URL);
  return client;
}
