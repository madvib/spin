/**
 * The stdio entry point: what an MCP client launches.
 *
 * The daemon's address comes from `--url <url>`, `--root <dir>`,
 * `SPIN_URL` / `SPIN_DAEMON_URL`, and absent all four, the local project
 * root in-process. No background server required: the CLI and the agent
 * host call the same router the daemon serves.
 *
 *   bun run src/main.ts --root /path/to/project
 */

import { resolveSpinClient } from "../api/index.ts";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createSpinMcpServer } from "./server.ts";

const args = process.argv.slice(2);
const flagValue = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

const server = await createSpinMcpServer(
  resolveSpinClient({ url: flagValue("--url"), root: flagValue("--root") }),
);
await server.connect(new StdioServerTransport());
