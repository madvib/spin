/**
 * `spin daemon` — the local distribution entry.
 *
 * One process, one port, one project root. The CLI, the MCP server, and the
 * studio all speak to this same surface; nothing here is dev tooling, so
 * there is no vite, no watcher, and no build step between this file and a
 * consumer on another machine. Run it, point a client at it, stop it.
 */

import { startDaemon } from "./daemon.ts";
import { join } from "node:path";

/**
 * `--port 0` asks the OS for a free port and prints what it got: the one
 * thing a local daemon cannot promise is a fixed number.
 */
const root = Deno.args.includes("--root")
  ? Deno.args[Deno.args.indexOf("--root") + 1] as string
  : Deno.cwd();
const portFlag = Deno.args.indexOf("--port");
const port = portFlag === -1 ? 7463 : Number(Deno.args[portFlag + 1]);

const daemon = startDaemon({ root, port });
console.log(`${daemon.url} — serving ${root}`);
// The discovery document already holds the address; printing it is for the
// developer who just typed the command.
console.log(`wrote ${join(root, "spin-connection.json")}`);
