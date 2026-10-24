/**
 * @spinjs/mcp — the MCP surface over the daemon's RPC.
 *
 * The server is built from a daemon client, so tests build it against a real
 * daemon on a temp root and this file stays wiring.
 */

export { buildSpinMcpServer } from "./server.ts";
