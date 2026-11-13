/**
 * Code snippets for the Tooling & Agents subgroup (`/docs/tooling/*`).
 */
export const TOOLING_SNIPPETS = {
  lint: `npx oxlint src/`,
  lintFix: `npx oxlint --fix src/`,
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
  initLinter: `npx spin init --linter oxlint`,
  initSkill: `npx spin init --skill`,
  oxlintConfig: `{
  "jsPlugins": ["@spinjs/dev/diagnostics"],
  "rules": {
    "spin/no-redundant-class": "error",
    "spin/prefer-theme-value": ["error", { "strictness": "balanced" }]
  }
}`,
  eslintConfig: `import spin from "@spinjs/dev/eslint";

export default [
  ...spin.configs.recommended,
  {
    rules: { "spin/prefer-theme-value": ["error", { strictness: "balanced" }] },
  },
];`,
} as const;
