/**
 * Code snippets for the Themes subgroup (`/docs/themes/*`).
 */
export const THEMES_SNIPPETS = {
  studioConfig: `{
  "activeTheme": "silk",
  "themeOrder": ["spin", "silk", "material", "neobrut", "industrial"]
}`,
  sparseExtends: `{
  "$extends": "silk",
  "modes": ["light", "dark"],
  "color": {
    "primary": { "$value": "#2563eb" }
  }
}`,
  composedAxes: `<html data-theme="silk" data-palette="catppuccin" data-spacing="compact" data-mode="dark">
  <!-- base theme decides the look, palette swaps the ink,
       spacing swaps the rhythm, mode picks the dark answer -->
</html>`,
  nestedFacets: `<div data-theme="silk" data-spacing="compact">
  <!-- dense sidebar: page ink and type, tighter rhythm -->
  <aside>…</aside>
  <aside data-palette="catppuccin" data-mode="dark">
    <!-- marketing panel: Catppuccin ink, dark answer -->
  </aside>
</div>`,
  composedSubtree: `<div data-palette="catppuccin" data-spacing="compact" data-mode="dark" class="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
  <strong>Release pipeline</strong>
  <p class="text-text-muted">Ink from Catppuccin, rhythm from compact, mode scoped to this card.</p>
  <div class="flex flex-wrap items-center gap-4">
    <button type="button" class="primary">Promote build</button>
    <button type="button">Compare diff</button>
  </div>
</div>`,
  compositeVoice: `{
  "font": {
    "style": {
      "heading": {
        "$type": "typography",
        "$value": {
          "family": "{font.family.heading}",
          "size": "{font.size.lg}",
          "weight": "{font.weight.semibold}",
          "tracking": "{font.tracking.tight}",
          "leading": "{font.leading.snug}"
        }
      }
    }
  }
}`,
  fontMap: `{
  "font": {
    "map": {
      "h1": "title",
      "card.title": "card-title",
      "dt": null
    }
  }
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
    <p class="type-caption text-text-muted">Rendered with data-mode="light".</p>
    <button class="primary">Primary Action</button>
  </article>

  <article class="card" data-theme="silk" data-mode="dark">
    <h3>Dark Subtree</h3>
    <p class="type-caption text-text-muted">Scoped to data-mode="dark" with zero dark: classes.</p>
    <button class="primary">Primary Action</button>
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
    "radius": { "$type": "dimension", "$value": "{radius.full}" },
    "edge": { "$type": "color", "$value": "{color.border-strong}" }
  },
  "card": {
    "radius": { "$type": "dimension", "$value": "{radius.lg}" },
    "elevation": { "$type": "shadow", "$value": "{shadow.md}" }
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
