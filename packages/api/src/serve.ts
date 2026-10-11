/**
 * `spin daemon` — the local distribution entry.
 *
 * One process, one port, one project root. The CLI, the MCP server, and the
 * studio all speak to this same surface; nothing here is dev tooling, so
 * there is no vite, no watcher, and no build step between this file and a
 * consumer on another machine. Run it, point a client at it, stop it.
 */

import { createDaemonApp, serveDaemon } from "./daemon.ts";

const root = Deno.args.includes("--root")
  ? Deno.args[Deno.args.indexOf("--root") + 1] as string
  : Deno.cwd();
const portFlag = Deno.args.indexOf("--port");
const port = portFlag === -1 ? 7463 : Number(Deno.args[portFlag + 1]);

serveDaemon(createDaemonApp({ root }), port);
console.log(`spin daemon serving ${root} on http://localhost:${port}/rpc`);
