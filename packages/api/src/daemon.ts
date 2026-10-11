/**
 * The spin daemon: the production path for every client.
 *
 * One Hono app, three hosts. The CLI talks to it over a socket, the MCP
 * server mounts or proxies it, vent mounts `app` as a sub-router, and the
 * studio points its RPC client at it. Nothing here is dev tooling: the only
 * vite process in the system is the studio's own, and the daemon never sees
 * it.
 *
 * The app owns NOTHING procedural — it mounts `@spin/api`'s router at `/rpc`
 * and serves it. A request the router does not claim falls through to a 404,
 * so the daemon is a pure RPC surface with no pages and no UI of its own.
 */

import { Hono } from "hono";
import { handleApiRequest } from "./index.ts";
import { setProjectRoot } from "@spin/theme";

/** A daemon pointed at a project: its root, which it never leaves. */
export interface DaemonOptions {
  /** The project root. All theme reads and writes resolve under it. */
  readonly root: string;
}

/**
 * The daemon app. The `root` is captured for the filesystem procedures the
 * daemon implements against `@spin/api`'s contract; text→text procedures
 * never see it, and the theme package never imports this file.
 */
export function createDaemonApp(options: DaemonOptions) {
  // The single write of the process: the daemon is pointed at a project once,
  // at startup, and every filesystem procedure reads from that. Hosting it in
  // vent means vent's mount owns this call instead.
  setProjectRoot(options.root);
  const app = new Hono();

  app.all("/rpc/*", async (c) => {
    const { matched, response } = await handleApiRequest(c.req.raw, {
      prefix: "/rpc",
    });
    return matched ? response : c.notFound();
  });

  app.notFound((c) => c.text("no procedure claims this path", 404));
  return app;
}

/**
 * Serve the daemon on a port. The entry file calls this; tests call it on
 * port 0 and read the address back. One shape, two callers.
 */
export function serveDaemon(
  app: ReturnType<typeof createDaemonApp>,
  port: number,
): Deno.HttpServer<Deno.NetAddr> {
  return Deno.serve(
    { port, onListen: () => {} },
    (request) => app.fetch(request),
  );
}
