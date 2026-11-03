/**
 * Code snippets for the Themes subgroup (`/docs/themes/*`).
 */
export const THEMES_SNIPPETS = {
  studioConfig: `{
  "activeTheme": "silk",
  "themeOrder": ["silk", "spin", "neobrut", "console", "synthwave"]
}`,
  viteSharedBrand: `import { defineConfig } from "vite";
import { spin } from "@spinjs/spin/vite";
import { starterThemes } from "@spinjs/spin/theme";
import { acmeBrand } from "@acme/brand-theme";

export default defineConfig({
  plugins: [
    spin.vite({
      // Share a company brand package, or mount the five starter palettes:
      extends: acmeBrand,
      // extends: { themes: starterThemes },
    }),
  ],
});`,
  bundlerPlugin: `import { spin } from "@spinjs/spin/vite";
// spin.vite(), spin.rspack(), spin.webpack(), spin.bun(), and the rest
// all share one options surface: { extends, themes, activeTheme }.

export const plugins = [
  spin.vite({
    // extends: { themes: starterThemes },
  }),
];`,
  modeToken: `{
  "$description": "Editorial palette with warm paper and crimson ink.",
  "modes": ["light", "dark"],
  "color": {
    "$type": "color",
    "neutral": {
      "50": { "$value": "#fbfaf8", "$modes": { "dark": "#141413" } },
      "900": { "$value": "#18181b", "$modes": { "dark": "#f4f4f0" } }
    },
    "surface": { "$value": "{color.neutral.50}" },
    "text": { "$value": "{color.neutral.900}" },
    "primary": {
      "$value": "#c8102e",
      "$modes": { "dark": "#ff5a63" }
    },
    "on-primary": { "$value": "#ffffff" }
  }
}`,
  subtreeMode: `<div class="grid gap-4 md:grid-cols-2">
  <article class="card" data-theme="silk" data-mode="light">
    <h3>Light Container</h3>
    <p class="text-sm text-text-muted">Rendered with data-mode="light".</p>
    <button>Primary Action</button>
  </article>

  <article class="card" data-theme="silk" data-mode="dark">
    <h3>Dark Subtree</h3>
    <p class="text-sm text-text-muted">Scoped to data-mode="dark" with zero dark: classes.</p>
    <button>Primary Action</button>
  </article>
</div>`,
  pickers: `<!-- Copy a ready-made control into your app: -->
<!-- npx spin component copy mode-picker basic -->

<script type="module">
  // Or drive the mode directly — Spin reads data-mode on <html>:
  document.documentElement.dataset.mode = "dark";
</script>`,
  webFonts: `{
  "$extensions": {
    "spin": {
      "fonts": [
        {
          "family": "Fraunces",
          "src": "url(https://cdn.jsdelivr.net/fontsource/fonts/fraunces:vf@latest/latin-wght-normal.woff2) format(\\"woff2\\")",
          "weight": "300 900",
          "style": "normal",
          "display": "swap"
        },
        {
          "family": "Plus Jakarta Sans",
          "src": "url(/fonts/plus-jakarta-sans.woff2) format(\\"woff2\\")",
          "weight": "400 700",
          "style": "normal",
          "display": "swap"
        }
      ]
    }
  },
  "font": {
    "family": {
      "$type": "fontFamily",
      "heading": { "$value": ["Fraunces", "Georgia", "serif"] },
      "sans": { "$value": ["Plus Jakarta Sans", "system-ui", "sans-serif"] }
    }
  }
}`,
  elementOverride: `{
  "button": {
    "weight": { "$type": "fontWeight", "$value": "{font.weight.semibold}" },
    "case": { "$type": "string", "$value": "uppercase" },
    "tracking": { "$type": "dimension", "$value": "{font.letter-spacing.wide}" },
    "edge": { "$type": "color", "$value": "{color.border-strong}" }
  },
  "card": {
    "radius": { "$type": "dimension", "$value": "{radius.lg}" },
    "shadow": { "$type": "shadow", "$value": "{shadow.md}" }
  }
}`,
  cliAnalyze: `# Lint source files AND spin/*.json themes together
npx spin lint .

# Or inspect themes directly from the CLI
npx spin theme list
npx spin theme analyze
npx spin theme scaffold > spin/acme.json`,
  validateTheme: `import { readFileSync } from "node:fs";
import { validateTheme } from "@spinjs/spin/theme";

const text = readFileSync("spin/default.json", "utf8");
const report = validateTheme(text, { modes: ["light", "dark"] });

if (!report.valid) {
  for (const issue of report.issues) {
    console.error(\`\${issue.path}: \${issue.message}\`);
  }
}`,
  resolveTheme: `import {
  indexTree,
  parseTokens,
  resolveAliases,
  resolveTheme,
  spinTheme,
  starterThemes,
} from "@spinjs/spin/theme";

// 1. Resolve every token to its final string value in a mode:
const dark = resolveTheme(spinTheme, "dark");
console.log(dark.values["color.primary"]); // "#ff5a63"
console.log(dark.values["color.surface"]); // "#0c0c0b"

// 2. Non-throwing parse + alias resolution when you need $type or $modes metadata:
const parsed = parseTokens(starterThemes.silk);
if (parsed.ok) {
  const index = indexTree(resolveAliases(parsed.tree).tree);
  const primary = index.leaves["color.primary"];
  console.log(primary?.type, primary?.value, primary?.modes);
}`,
} as const;
