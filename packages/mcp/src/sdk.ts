/**
 * The SDK surface this package uses, in one module.
 *
 * @modelcontextprotocol/sdk's exports map types only the extensionless
 * subpath (`./server/mcp` → `dist/esm/server/mcp.d.ts`) while runtime needs
 * the `.js` form (`./server/mcp.js` → `dist/esm/server/mcp.js`); neither
 * spelling serves both, and an untyped import is what an agent-authored bug
 * looks like. Each `@deno-types` directive below supplies the types its
 * runtime import cannot carry, so a fixed exports map upstream deletes this
 * file and nothing else.
 *
 * `Client` and `InMemoryTransport` are the test side of the same library.
 */

// @deno-types="@modelcontextprotocol/sdk/server/mcp"
export {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
// @deno-types="@modelcontextprotocol/sdk/server/stdio"
export { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// @deno-types="@modelcontextprotocol/sdk/client/index"
export { Client } from "@modelcontextprotocol/sdk/client/index.js";
// @deno-types="@modelcontextprotocol/sdk/inMemory"
export { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
