/**
 * Code snippets for the Getting Started subgroup (`/docs/getting-started/*`).
 */
export const GETTING_STARTED_SNIPPETS = {
  install: `npm install -D @spinjs/spin\nnpm install @spinjs/components`,
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
  componentsDir: new URL("../src/lib/components", import.meta.url).pathname,
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
  readFileSync(new URL("./spin/<brand>/tokens.json", import.meta.url), "utf8"),
);

export default defineConfig({
  presets: [spinPreset({ themes: { "<name>": spinTheme } })],
});`,
  studioServe: `npx spin studio`,
  viteOptions: `spin.vite({
  themesDir: "spin",
  componentsDir: "src/lib/components",
  prefix: "app",
  shortcuts: {
    "page-shell": "mx-auto w-full max-w-screen-lg px-6 py-10",
  },
  studio: true,
});`,
  firstMarkup: `<card class="card-default">
  <card-header>
    <card-title>Settings</card-title>
    <card-description>Changes save automatically.</card-description>
  </card-header>
  <card-footer>
    <button class="primary">Save now</button>
  </card-footer>
</card>`,
  dev: `npm run dev`,
  mcpConfig: `{
  "mcpServers": {
    "spin": {
      "command": "npx",
      "args": ["spin", "mcp"]
    }
  }
}`,
  agentPrompt: `This project uses Spin (@spinjs/spin). Connect to the \`spin\` MCP server in .mcp.json and read /llms.txt (or run \`npx spin --help\`) before writing UI: style exclusively through spin/<brand>/ tokens, bare-tag elements (<card>, <button class="primary">, <input>), and project-declared compositions (spin.vite({ shortcuts })); vendor interactive widgets via \`npx spin component copy\`; and run \`npx spin lint .\` before finishing.`,
} as const;
