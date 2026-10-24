/**
 * The spin daemon: the standalone entry for consumers without a bundler.
 *
 * One Hono app, every host: this mounts the same `createSpinApp` the dev
 * server mounts, so standalone and dev never drift. The daemon binds
 * loopback by default, because it writes to disk and a socket open to the
 * network is a remote write to a developer's project for anyone who can
 * reach the port.
 *
 * There is intentionally no CORS, no discovery file, and no port
 * negotiation. Same-origin in dev made all three dead: the client dials a
 * relative `/__spin/rpc`, fixed at config time, and a consumer that needs
 * the address reads it from the process that started it.
 */

import { createSpinApp } from "./index.ts";

/** A daemon pointed at a project: its root, which it never leaves. */
export interface DaemonOptions {
  /** The project root. All theme reads and writes resolve under it. */
  readonly root: string;
  /**
   * The address to bind. Defaults to loopback, because the daemon writes to
   * disk and a socket open to the network is a remote write to a developer's
   * project for anyone who can reach the port. Widening this is an explicit
   * decision, not a default.
   */
  readonly hostname?: string;
}

/** A started daemon: its app, its address, and how to stop it. */
export interface Daemon {
  /** The RPC URL, including the port that was actually bound. */
  readonly url: string;
  /** Stop serving. */
  close(): void;
}

/**
 * Start the daemon: bind a port and serve the shared app.
 *
 * Binding comes before advertising because `port: 0` asks the OS for a free
 * port and the advertised number must be the one that was actually bound.
 */
export function startDaemon(
  options: DaemonOptions & { readonly port?: number },
): Daemon {
  const app = createSpinApp({ root: options.root, base: "/rpc" });
  const server = Bun.serve({
    hostname: options.hostname ?? "127.0.0.1",
    port: options.port ?? 7463,
    fetch: (request) => app.fetch(request),
  });
  const bound = server.port;
  return {
    url: `http://localhost:${bound}/rpc`,
    close() {
      server.stop();
    },
  };
}
