/**
 * Code snippets for the Getting Started subgroup (`/docs/getting-started/*`).
 */
export const GETTING_STARTED_SNIPPETS = {
  install: `npm install -D @spinjs/spin\nnpm install @spinjs/components @spinjs/runtime`,
  vite: `import { spin } from "@spinjs/spin/vite";

export default {
  plugins: [spin.vite()],
};`,
  entry: `// src/main.ts — the entry your bundler reads
import "uno.css";`,
  declareCss: `// uno.d.ts — the virtual module's type
declare module "uno.css";`,
  viteThemes: `import { spin } from "@spinjs/spin/vite";
import { starterThemes } from "@spinjs/spin/theme/themes";
import myTheme from "./theme.json" with { type: "json" };

export default {
  plugins: [spin.vite({ themes: { myTheme, ...starterThemes } })],
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
  studioServe: `npx spin studio --root .`,
  viteOptions: `spin.vite({
  primitives: ["button", "card"],
  classless: false,
});`,
  firstMarkup: `<main class="stack">
  <h1>Settings</h1>
  <p>Changes save automatically.</p>
  <button>Save now</button>
</main>`,
  dev: `npm run dev`,
} as const;
