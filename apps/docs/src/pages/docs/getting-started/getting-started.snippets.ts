/**
 * Code snippets for the Getting Started subgroup (`/docs/getting-started/*`).
 */
export const GETTING_STARTED_SNIPPETS = {
  install: `npm install -D @spinjs/spin\nnpm install @spinjs/components @spinjs/runtime`,
  init: `npx spin init`,
  vite: `import { spin } from "@spinjs/spin/vite";

export default {
  plugins: [spin.vite()],
};`,
  entry: `// src/main.ts — the entry your bundler reads
import "spin/styles.css";
import "spin/components";`,
  declareCss: `// Auto-generated in src/spin-components.d.ts by spin init & spin.<bundler>()
declare module "spin/styles.css";
declare module "spin/components";`,
  brandExport: `// packages/brand/src/spin.ts
import acme from "../spin/acme.json" with { type: "json" };

export const acmeBrand = {
  themes: { acme },
  componentsDir: new URL("../lib/components", import.meta.url).pathname,
};`,
  viteExtends: `import { spin } from "@spinjs/spin/vite";
import { acmeBrand } from "@acme/brand/spin";

export default {
  plugins: [spin.vite({ extends: acmeBrand })],
};`,
  studio: `import { spin } from "@spinjs/spin/vite";

export default {
  plugins: [spin.vite({ studio: false })],
};`,
  rollup: `import { spin } from "@spinjs/spin/vite";
export default { plugins: [spin.rollup()] };`,
  rspack: `import { defineConfig } from "@rspack/cli";
import { spin } from "@spinjs/spin/vite";

export default defineConfig({ plugins: [spin.rspack()] });`,
  webpack: `import { spin } from "@spinjs/spin/vite";
export default { plugins: [spin.webpack()] };`,
  rolldown: `import { spin } from "@spinjs/spin/vite";
import { defineConfig } from "rolldown";

export default defineConfig({ plugins: [spin.rolldown()] });`,
  esbuild: `import { spin } from "@spinjs/spin/vite";

export const plugins = [spin.esbuild()];`,
  bun: `import { spin } from "@spinjs/spin/vite";

export const plugins = [spin.bun()];`,
  unocss: `import { readFileSync } from "node:fs";
import { defineConfig } from "unocss";
import { spinPreset } from "@spinjs/spin/preset";

const spinTheme = JSON.parse(
  readFileSync(new URL("./spin/<name>.json", import.meta.url), "utf8"),
);

export default defineConfig({
  presets: [spinPreset({ themes: { "<name>": spinTheme } })],
});`,
  studioServe: `npx spin studio`,
  viteOptions: `spin.vite({
  primitives: ["button", "card"],
  classless: false,
});`,
  firstMarkup: `<main class="stack">
  <h1>Settings</h1>
  <p>Changes save automatically.</p>
  <button class="primary">Save now</button>
</main>`,
  dev: `npm run dev`,
  mcpConfig: `{
  "mcpServers": {
    "spin": {
      "command": "npx",
      "args": ["spin", "mcp"]
    }
  }
}`,
  agentPrompt: `# Spin UI Rules for Coding Agents

1. **Theme owns every visual value (\`spin/*.json\`).** Never write \`.css\` files, \`<style>\` blocks, inline \`style={{}}\`, or arbitrary bracket classes (\`w-[320px]\`, \`bg-[#fff]\`). Every color, font, spacing step, radius, shadow, and motion curve comes from the DTCG theme.
2. **Classless elements first.** Native HTML and Spin tags arrive styled by the theme:
   - Actions & inputs: \`<button>\` (neutral), \`<button class="primary">\` (CTA), \`.secondary\`, \`.ghost\`, \`.destructive\`, \`.bare\` (strip chrome), \`<input>\`, \`<select>\`, \`<textarea>\`, \`<label>\`, \`<field>\`
   - Containers & data: \`<card>\`, \`<panel>\`, \`<dialog>\`, \`<details>\`, \`<fieldset>\`, \`<table>\`, \`<badge>\`, \`<alert>\`, \`<stat>\`, \`<progress>\`, \`<meter>\`, \`<skeleton>\`, \`<prose>\`
   - Never re-declare padding, borders, radii, or backgrounds that an element already sets (\`spin/no-redundant-class\`, \`spin/prefer-theme-value\`).
3. **Closed-scale utilities & layout shortcuts.** Use shortcuts for layout: \`stack\`, \`stack-xs\`, \`stack-sm\`, \`stack-lg\`, \`row\`, \`row-sm\`, \`row-lg\`, \`split\`, \`cluster\`, \`inline\`, \`overline\`. Pair every fill with its semantic ink (\`bg-primary text-on-primary\`, \`bg-surface-raised text-text\`, \`bg-success text-on-semantic-success\`). Dark mode is automatic via \`[data-mode="dark"]\` — never write \`dark:*\` classes.
4. **Interactive widgets come from \`@spinjs/components\`.** Never hand-roll custom select, combobox, tabs, dialog, menu, popover, or date-picker state. Run \`npx spin component list\`, vendor a recipe with \`npx spin component copy <name> <example>\` (writes \`lib/components/<name>/<example>.html\` -> \`<prefix>-<name>-<example>\`), and bind with \`createSpinComponent\` (Solid) or \`useSpinComponent\` (React).
5. **Verify before finishing.** Always run \`npx spin lint .\` and \`npx spin theme analyze\` (or use the \`spin\` MCP server tools) and fix all findings before yielding.`,
} as const;
