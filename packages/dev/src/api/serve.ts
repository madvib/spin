/**
 * The local daemon entry; `spin studio` starts it.
 *
 * One process, one port, one project root. The CLI, the MCP server, and the
 * studio all speak to this same surface; nothing here is dev tooling, so
 * there is no vite, no watcher, and no build step between this file and a
 * consumer on another machine. Run it, point a client at it, stop it.
 */

import { createSpinApp } from "./index.ts";
import { startDaemon } from "@spinjs/server/daemon";

/**
 * `--port 0` asks the OS for a free port and prints what it got: the one
 * thing a local daemon cannot promise is a fixed number.
 */
const root = process.argv.includes("--root")
  ? process.argv[process.argv.indexOf("--root") + 1] as string
  : process.cwd();
const portFlag = process.argv.indexOf("--port");
const port = portFlag === -1 ? 7463 : Number(process.argv[portFlag + 1]);

// Loopback by default, which is the whole point: the daemon writes to disk,
// and a port open to the network is a remote write to a developer's project.
// `--host 0.0.0.0` is available and is a deliberate choice.
const hostFlag = process.argv.indexOf("--host");
const daemon = await startDaemon({
  root,
  app: createSpinApp({ root, base: "/rpc" }),
  port,
  ...(hostFlag === -1 ? {} : { hostname: process.argv[hostFlag + 1] as string }),
});
console.log(`${daemon.url} — serving ${root}`);