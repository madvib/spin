/**
 * Code snippets for the Tooling & Agents subgroup (`/docs/tooling/*`).
 */
export const TOOLING_SNIPPETS = {
  lint: `npx spin lint src/`,
  lintFix: `npx spin lint --fix src/`,
  studioServe: `npx spin studio --root .`,
  mcp: `npx spin mcp --root .`,
  mcpConfig: `{
  "mcpServers": {
    "spin": {
      "command": "npx",
      "args": ["spin", "mcp", "--root", "."]
    }
  }
}`,
  checkRun: `npx spin check --config visual/check.config.ts`,
} as const;
