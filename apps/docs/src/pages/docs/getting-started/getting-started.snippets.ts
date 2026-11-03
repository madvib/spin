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
import "uno.css";
import "spin/components";`,
  declareCss: `// src/spin-virtual.d.ts — virtual module declarations
declare module "uno.css";
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
} as const;
