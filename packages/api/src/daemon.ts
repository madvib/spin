/**
 * The spin daemon: the production path for every client.
 *
 * One Hono app, every host. The CLI points a client at it, the MCP server
 * proxies it, vent mounts the handler as a sub-router, and the studio's RPC
 * client dials it. Nothing here is dev tooling — the daemon never runs vite
 * and never builds assets. It is a process a consumer runs.
 *
 * The app is procedural only in the sense that it mounts `@spin/api`'s router
 * at `/rpc`: a request the router does not claim falls through to a 404, so
 * the daemon is a pure RPC surface with no pages and no UI of its own.
 */

import { Hono } from "hono";
import { handleApiRequest } from "./index.ts";
import { setProjectRoot } from "@spin/theme";
import { join } from "node:path";

/** A daemon pointed at a project: its root, which it never leaves. */
export interface DaemonOptions {
  /** The project root. All theme reads and writes resolve under it. */
  readonly root: string;
}

/** The document that tells a client where its daemon went. */
export const DISCOVERY_FILE = "spin-connection.json";

/**
 * The daemon app. The `root` is captured for the filesystem procedures the
 * daemon implements against `@spin/api`'s contract; text→text procedures
 * never see it, and the theme package never imports this file.
 */
export function createDaemonApp(options: DaemonOptions) {
  // The single write of the process: the daemon is pointed at a project once,
  // at startup, and every filesystem procedure reads from that. Hosting the
  // app in vent means vent's mount owns this call instead.
  setProjectRoot(options.root);
  // CORS, because a studio client and a daemon are separate origins in
  // development: the studio runs on vite's port and the daemon on its own.
  // The daemon binds localhost, so answering any origin on the two paths it
  // owns accepts the dev shape without inventing an auth model for it.
  return new Hono()
    .use("/rpc/*", async (c, next) => {
      await next();
      c.res.headers.set("access-control-allow-origin", "*");
      c.res.headers.set(
        "access-control-allow-methods",
        "GET, POST, OPTIONS",
      );
      c.res.headers.set("access-control-allow-headers", "content-type");
    })
    .options("/rpc/*", () => new Response(null, { status: 204 }))
    .all("/rpc/*", async (c) => {
      const { matched, response } = await handleApiRequest(c.req.raw, {
        prefix: "/rpc",
      });
      return matched ? response : c.notFound();
    }).notFound((c) => c.text("no procedure claims this path", 404));
}

/** A started daemon: its app, its address, and how to stop it. */
export interface Daemon {
  readonly app: Hono;
  /** The RPC URL, including the port that was actually bound. */
  readonly url: string;
  /** Stop serving and delete the discovery document. */
  close(): void;
}

/** The route a client reads discovery over, when it cannot read disk. */
export const DISCOVERY_ROUTE = "/spin-connection.json";

/**
 * Start the daemon: bind a port, publish discovery, serve.
 *
 * Binding comes before publishing because `port: 0` asks the OS for a free
 * port and the advertised number must be the one that was actually bound.
 * The discovery file lives in the project root — the one place a client and
 * its daemon already share — and is removed on close, so a stale file cannot
 * point a later run at a dead port.
 */
export function startDaemon(
  options: DaemonOptions & { readonly port?: number },
): Daemon {
  const app = createDaemonApp(options);
  const server = Deno.serve(
    { port: options.port ?? 7463 },
    (request) => app.fetch(request),
  );
  const bound = (server.addr as Deno.NetAddr).port;
  const doc = { port: bound, path: "/rpc" };
  Deno.writeTextFileSync(
    join(options.root, DISCOVERY_FILE),
    `${JSON.stringify(doc, null, 2)}\n`,
  );
  // Served as well as written: a browser cannot read disk, so the studio
  // fetches this from the daemon's own origin.
  app.get(DISCOVERY_ROUTE, (c) => c.json(doc));
  return {
    app,
    url: `http://localhost:${bound}/rpc`,
    close() {
      server.shutdown();
      try {
        Deno.removeSync(join(options.root, DISCOVERY_FILE));
      } catch {
        // already gone
      }
    },
  };
}
