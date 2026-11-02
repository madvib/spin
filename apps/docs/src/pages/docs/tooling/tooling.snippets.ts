/**
 * Code snippets for the Tooling & Agents subgroup (`/docs/tooling/*`).
 */
export const TOOLING_SNIPPETS = {
  lint: `npx spin lint src/`,
  lintFix: `npx spin lint --fix src/`,
  studioServe: `npx spin studio`,
  mcp: `npx spin mcp`,
  mcpConfig: `{
  "mcpServers": {
    "spin": {
      "command": "npx",
      "args": ["spin", "mcp"]
    }
  }
}`,
  checkRun: `npx spin check --config visual/check.config.ts`,
} as const;
