/**
 * The Start-here code, written once. The pages render these values; the test
 * beside this file resolves every package and subpath they name.
 */
export const SNIPPETS = {
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
  // The Studio mounts itself on every dev server. Only name it to
  // turn it off — a tool that is not its own target, a build that
  // serves no editor.
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
  lint: `npx spin lint src/`,
  lintFix: `npx spin lint --fix src/`,
  mcp: `npx spin mcp --root .`,
  mcpConfig: `{
  "mcpServers": {
    "spin": {
      "command": "npx",
      "args": ["spin", "mcp", "--root", "."]
    }
  }
}`,
  minimalTheme: `{
  "$description": "Warm paper and one red ink.",
  "color": {
    "$type": "color",
    "neutral": {
      "50": { "$value": "#f7f4ee", "$modes": { "dark": "#141312" } },
      "900": { "$value": "#161513", "$modes": { "dark": "#f0ebe3" } }
    },
    "surface": { "$value": "{color.neutral.50}" },
    "text": { "$value": "{color.neutral.900}" },
    "primary": {
      "$value": "#c8102e",
      "$modes": { "dark": "#ff5a63" }
    }
  },
  "font": {
    "family": {
      "sans": { "$type": "fontFamily", "$value": "Inter, system-ui, sans-serif" }
    }
  },
  "spacing": {
    "$type": "dimension",
    "4": { "$value": "1rem" }
  },
  "modes": ["light", "dark"]
}`,
  themeGates: `import { readFile } from "node:fs/promises";
import { themeGate, themeGates } from "@spinjs/spin/theme";

const text = await readFile("spin/<name>.json", "utf8");
const report = themeGates(text);
if (!report.valid) {
  for (const gate of report.gates) {
    for (const issue of gate.issues) {
      console.log(gate.gate + ": " + issue.path + " — " + issue.message);
    }
  }
}

// Run one gate or judge one mode on its own:
const darkLegibility = themeGate("legibility", text, { mode: "dark" });`,
  resolveTheme: `import {
  indexTree,
  parseTokens,
  resolveAliases,
  resolveTheme,
} from "@spinjs/spin/theme";
import { spinTheme } from "@spinjs/spin/theme/themes";

// Flat value map for one mode (throws on a malformed document;
// broken aliases are listed in \`unresolved\` rather than thrown):
const resolved = resolveTheme(spinTheme, "dark");
console.log(resolved.mode); // "dark"
console.log(resolved.values["color.primary"]); // "#ff5a63"
console.log(resolved.unresolved); // []

// Total parse + leaf index (never throws; keeps leaf types and $modes):
const parsed = parseTokens(spinTheme);
if (parsed.ok) {
  const index = indexTree(resolveAliases(parsed.tree).tree);
  const primary = index.leaves["color.primary"];
  console.log(primary?.type, primary?.value, primary?.modes?.dark);
}`,
  firstMarkup: `<main class="stack">
  <h1>Settings</h1>
  <p>Changes save automatically.</p>
  <button>Save now</button>
</main>`,
  dev: `npm run dev`,
} as const;
