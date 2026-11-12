/**
 * Code snippets for the Getting Started subgroup (`/docs/getting-started/*`).
 */
export const GETTING_STARTED_SNIPPETS = {
  install: `npm install -D @spinjs/dev\nnpm install @spinjs/components`,
  init: `npx spin init`,
  studioServe: `npx spin studio`,
  vite: `import { spin } from "@spinjs/dev/vite";

export default {
  plugins: [spin.vite()],
};`,
  entry: `import "spin/styles.css";`,
  declareCss: `// Auto-generated in src/spin-components.d.ts by the bundler plugin
declare module "spin/styles.css";
declare module "spin/components";`,
  brandExport: `// packages/brand/src/spin.ts
import tokens from "../spin/acme/tokens.json" with { type: "json" };

export const brand = {
  themes: { acme: tokens },
};`,
  viteExtends: `import { spin } from "@spinjs/dev/vite";
import { brand } from "@acme/brand";

export default {
  plugins: [spin.vite({ extends: brand })],
};`,
  studio: `import { spin } from "@spinjs/dev/vite";

export default {
  plugins: [spin.vite({ studio: false })],
};`,
  rollup: `import { spin } from "@spinjs/dev/vite";

export default {
  plugins: [spin.rollup()],
};`,
  rspack: `import { defineConfig } from "@rspack/cli";
import { spin } from "@spinjs/dev/vite";

export default defineConfig({
  plugins: [spin.rspack()],
});`,
  webpack: `import { spin } from "@spinjs/dev/vite";

export default {
  plugins: [spin.webpack()],
};`,
  rolldown: `import { defineConfig } from "rolldown";
import { spin } from "@spinjs/dev/vite";

export default defineConfig({
  plugins: [spin.rolldown()],
});`,
  esbuild: `import { spin } from "@spinjs/dev/vite";

export const plugins = [spin.esbuild()];`,
  bun: `import { spin } from "@spinjs/dev/vite";

export const plugins = [spin.bun()];`,
  unocss: `import { readFileSync } from "node:fs";
import { defineConfig } from "unocss";
import { spinPreset } from "@spinjs/dev/preset";

const brandTheme = JSON.parse(
  readFileSync(new URL("./spin/acme/tokens.json", import.meta.url), "utf8"),
);

export default defineConfig({
  presets: [spinPreset({ themes: { acme: brandTheme } })],
});`,
  viteOptions: `spin.vite({
  themesDir: "spin",
  componentsDir: "src/components/ui",
  shortcuts: {
    stack: "flex flex-col gap-4",
    row: "flex items-center gap-3",
  },
});`,
  firstMarkup: `<card class="max-w-md">
  <card-header>
    <card-title>Team workspace</card-title>
    <card-description>Invite collaborators and manage deploy keys.</card-description>
  </card-header>
  <card-content>
    <label>
      Workspace name
      <input type="text" placeholder="Acme Engineering" />
    </label>
  </card-content>
  <card-footer class="justify-end gap-2">
    <button type="button" class="ghost">Cancel</button>
    <button type="button" class="primary">Create workspace</button>
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
} as const;
