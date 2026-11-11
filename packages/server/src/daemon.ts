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

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

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

/** Bun's serve handle, when the daemon runs under Bun. */
interface BunServer {
  readonly port: number;
  stop(): void;
}

/** The Node request body, collected before the fetch-style app sees it. */
async function bodyOf(request: IncomingMessage): Promise<Buffer | undefined> {
  const parts: Buffer[] = [];
  for await (const part of request) parts.push(Buffer.from(part as Uint8Array));
  return parts.length === 0 ? undefined : Buffer.concat(parts);
}

/**
 * Serve one Node request through the fetch-style app.
 *
 * The daemon's surface is a Hono app, and Hono speaks `Request`/`Response`;
 * the adapter is deliberately literal — collect the body, call `fetch`, write
 * the response back — so a new procedure needs nothing here.
 */
async function serveNode(
  app: { fetch(request: Request): Response | Promise<Response> },
  bind: { port: number },
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const host = request.headers.host ?? `localhost:${bind.port}`;
    const body = await bodyOf(request);
    const headers: [string, string][] = [];
    for (const [name, value] of Object.entries(request.headers)) {
      if (value === undefined) continue;
      headers.push([name, Array.isArray(value) ? value.join(", ") : value]);
    }
    const bytes = body === undefined ? undefined : new Uint8Array(body);
    const outgoing = new Request(new URL(request.url ?? "/", `http://${host}`), {
      method: request.method ?? "GET",
      headers,
      ...(bytes === undefined ? {} : { body: bytes }),
    });
    const result = await app.fetch(outgoing);
    response.statusCode = result.status;
    result.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch (error: unknown) {
    response.statusCode = 500;
    response.end(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Start the daemon: bind a port and serve the app it is given.
 *
 * Binding comes before advertising because `port: 0` asks the OS for a free
 * port and the advertised number must be the one that was actually bound.
 *
 * Bun is the dev runtime, Node is the published one: the same dist entry runs
 * under both, so the server is chosen at runtime rather than by the package's
 * shebang. The app arrives as a parameter — the composition owns what the
 * daemon serves, and the daemon owns only the socket.
 */
/** The app the daemon serves: anything with a fetch entry. */
export interface ServableApp {
  fetch(request: Request): Response | Promise<Response>;
}

export async function startDaemon(
  options: DaemonOptions & { readonly port?: number; readonly app: ServableApp },
): Promise<Daemon> {
  const app = options.app;
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? 7463;
  const bun = (globalThis as { Bun?: { serve?: (options: {
    hostname: string;
    port: number;
    fetch: (request: Request) => Response | Promise<Response>;
  }) => BunServer } }).Bun;
  if (bun?.serve !== undefined) {
    const server = bun.serve({
      hostname,
      port,
      fetch: (request) => app.fetch(request),
    });
    return {
      url: `http://localhost:${server.port}/rpc`,
      close() {
        server.stop();
      },
    };
  }
  const server = createServer((request, response) => {
    void serveNode(app, { port }, request, response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, () => resolve());
  });
  const address = server.address();
  const bound = typeof address === "object" && address !== null
    ? address.port
    : port;
  return {
    url: `http://localhost:${bound}/rpc`,
    close() {
      server.close();
    },
  };
}
