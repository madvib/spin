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
  pickers: `import {
  ModePicker,
  ThemePicker,
  mode,
  setMode,
  setTheme,
  theme,
} from "@spinjs/spin/kit";

// Drop-in controls that read --spin-themes and --spin-modes from the stylesheet:
// <ThemePicker />
// <ModePicker />

// Or drive theme and mode state programmatically:
setTheme("neobrut");
setMode(mode() === "dark" ? "light" : "dark");
console.log(theme(), mode());`,
  webFonts: `{
  "$extensions": {
    "spin": {
      "fonts": [
        {
          "family": "Fraunces",
          "source": "fontsource",
          "weights": [600, 700]
        },
        {
          "family": "Plus Jakarta Sans",
          "source": "fontsource",
          "weights": [400, 500, 600]
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
  cliAnalyze: `# List all themes resolved in spin/ and extends
npx spin theme list

# Run the six-gate validation battery against every project theme
npx spin theme analyze

# Scaffold a new valid theme document into spin/acme.json
npx spin theme scaffold --name acme`,
  themeGates: `import { readFileSync } from "node:fs";
import { themeGate, themeGates } from "@spinjs/spin/theme";

const text = readFileSync("spin/acme.json", "utf8");

// Run all six gates (completeness, legibility, scales, motion, modes, invariance):
const findings = themeGates(text);
for (const issue of findings) {
  console.error(\`[\${issue.gate}] \${issue.path}: \${issue.message}\`);
}

// Or run a single gate on a specific mode:
const contrastIssues = themeGate("legibility", text, { mode: "dark" });`,
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
