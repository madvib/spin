/**
 * The stdio entry point: what an MCP client launches.
 *
 * The daemon's address comes from `--daemon <url>` or `SPIN_DAEMON_URL`, and
 * absent both, the daemon's own default. Not discovery: the daemon binds a
 * fixed address at config time, and a client that runs it does too.
 *
 *   bun run src/main.ts --daemon http://127.0.0.1:7463/rpc
 */

import { createSpinClient } from "@spin/api";
import { StdioServerTransport } from "./sdk.ts";
import { buildSpinMcpServer } from "./server.ts";

const flag = process.argv.indexOf("--daemon");
const url = (flag >= 0 ? process.argv[flag + 1] : undefined) ??
  process.env["SPIN_DAEMON_URL"] ??
  "http://127.0.0.1:7463/rpc";

const server = buildSpinMcpServer(createSpinClient(url));
await server.connect(new StdioServerTransport());
