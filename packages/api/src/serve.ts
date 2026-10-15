/**
 * `spin daemon` — the local distribution entry.
 *
 * One process, one port, one project root. The CLI, the MCP server, and the
 * studio all speak to this same surface; nothing here is dev tooling, so
 * there is no vite, no watcher, and no build step between this file and a
 * consumer on another machine. Run it, point a client at it, stop it.
 */

import { startDaemon } from "./daemon.ts";

/**
 * `--port 0` asks the OS for a free port and prints what it got: the one
 * thing a local daemon cannot promise is a fixed number.
 */
const root = Deno.args.includes("--root")
  ? Deno.args[Deno.args.indexOf("--root") + 1] as string
  : Deno.cwd();
const portFlag = Deno.args.indexOf("--port");
const port = portFlag === -1 ? 7463 : Number(Deno.args[portFlag + 1]);

// Loopback by default, which is the whole point: the daemon writes to disk,
// and a port open to the network is a remote write to a developer's project.
// `--host 0.0.0.0` is available and is a deliberate choice.
const hostFlag = Deno.args.indexOf("--host");
const daemon = startDaemon({
  root,
  port,
  ...(hostFlag === -1 ? {} : { hostname: Deno.args[hostFlag + 1] as string }),
});
console.log(`${daemon.url} — serving ${root}`);
