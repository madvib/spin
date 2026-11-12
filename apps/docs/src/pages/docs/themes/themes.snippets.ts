/**
 * Code snippets for the Themes subgroup (`/docs/themes/*`).
 */
export const THEMES_SNIPPETS = {
  studioConfig: `{
  "activeTheme": "minimal",
  "themeOrder": ["minimal", "editorial", "material", "neobrutalist", "neumorphic", "glassmorphic"]
}`,
  sparseExtends: `{
  "$extends": "minimal",
  "modes": ["light", "dark"],
  "color": {
    "primary": { "$value": "#2563eb" }
  }
}`,
  composedAxes: `<html data-theme="minimal" data-palette="catppuccin" data-spacing="compact" data-mode="dark">
  <!-- base theme decides the look, palette swaps the ink,
       spacing swaps the rhythm, mode picks the dark answer -->
</html>`,
  nestedFacets: `<div data-theme="minimal" data-spacing="compact">
  <!-- dense sidebar: page ink and type, tighter rhythm -->
  <aside>…</aside>
  <aside data-palette="catppuccin" data-mode="dark">
    <!-- marketing panel: Catppuccin ink, dark answer -->
  </aside>
</div>`,
  composedSubtree: `<div data-palette="catppuccin" data-spacing="compact" data-mode="dark" class="flex flex-col gap-4 rounded-lg border bg-surface p-4">
  <strong>Release pipeline</strong>
  <p class="text-muted">Ink from Catppuccin, rhythm from compact, mode scoped to this card.</p>
  <div class="flex flex-wrap items-center gap-4">
    <button type="button" class="primary">Promote build</button>
    <button type="button">Compare diff</button>
  </div>
</div>`,
  paletteFacet: `{
  "modes": ["light", "dark"],
  "color": {
    "$type": "color",
    "surface": { "$value": "#eff1f5", "$modes": { "dark": "#1e1e2e" } },
    "surface-raised": { "$value": "#e6e9ef", "$modes": { "dark": "#313244" } },
    "text": { "$value": "#4c4f69", "$modes": { "dark": "#cdd6f4" } },
    "primary": { "$value": "#8839ef", "$modes": { "dark": "#cba6f7" } },
    "on-primary": { "$value": "#ffffff", "$modes": { "dark": "#11111b" } }
  }
}`,
  spacingFacet: `{
  "spacing": {
    "$type": "dimension",
    "1": { "$value": "0.1875rem" },
    "2": { "$value": "0.375rem" },
    "3": { "$value": "0.5rem" },
    "4": { "$value": "0.75rem" },
    "6": { "$value": "1rem" }
  }
}`,
  brandLayers: `spin/
  brand.json                     # Active brand name: { "name": "acme" }
  acme/
    tokens.json                  # Brand identity: "$extends", faces, type styles, palette, shape
    reference.json               # Optional raw scale overrides (color ramps, spacing steps)
    elements.json                # Optional HTML element typography overrides (element.h1.type)
    primitives/
      <component>.json           # Optional per-primitive overrides (button.radius, card.title.type)
    themes/
      catppuccin.palette.json    # Optional palette facet (data-palette="catppuccin")
      compact.spacing.json       # Optional spacing facet (data-spacing="compact")`,
  compositeStyle: `{
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
  typeAlias: `{
  "element": {
    "h1": {
      "type": { "$type": "typography", "$value": "{font.style.title}" }
    }
  },
  "card": {
    "title": {
      "type": { "$type": "typography", "$value": "{font.style.title}" }
    }
  }
}`,
  viteSharedBrand: `import { defineConfig } from "vite";
import { spin } from "@spinjs/dev/vite";
import { designLanguages } from "@spinjs/dev/theme";
import { acmeBrand } from "@acme/brand-theme";

export default defineConfig({
  plugins: [
    spin.vite({
      // Share a company brand package, or mount design languages directly:
      extends: acmeBrand,
      // extends: { themes: designLanguages },
    }),
  ],
});`,
  bundlerPlugin: `import { spin } from "@spinjs/dev/vite";
// spin.vite(), spin.rspack(), spin.webpack(), spin.bun(), and the rest
// all share one options surface: { extends, themes, activeTheme }.

export const plugins = [
  spin.vite({
    // extends: { themes: designLanguages },
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
  <article class="card" data-theme="minimal" data-mode="light">
    <h3>Light Container</h3>
    <p class="type-caption text-muted">Rendered with data-mode="light".</p>
    <button class="primary">Primary Action</button>
  </article>

  <article class="card" data-theme="minimal" data-mode="dark">
    <h3>Dark Subtree</h3>
    <p class="type-caption text-muted">Scoped to data-mode="dark" with zero dark: classes.</p>
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
  cliAnalyze: `# Lint source files AND spin/<brand>/ themes together
npx spin lint .

# Or inspect themes directly from the CLI
npx spin brand list
npx spin brand analyze
npx spin brand analyze acme`,
  validateTheme: `import { readFileSync } from "node:fs";
import { validateTheme } from "@spinjs/dev/theme";

const text = readFileSync("spin/default/tokens.json", "utf8");
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
  editorialLanguage,
  designLanguages,
} from "@spinjs/dev/theme";

// 1. Resolve every token to its final string value in a mode:
const dark = resolveTheme(editorialLanguage, "dark");
console.log(dark.values["color.primary"]); // "#ff5a63"
console.log(dark.values["color.surface"]); // "#0c0c0b"

// 2. Non-throwing parse + alias resolution when you need $type or $modes metadata:
const parsed = parseTokens(designLanguages.minimal);
  const index = indexTree(resolveAliases(parsed.tree).tree);
  const primary = index.leaves["color.primary"];
  console.log(primary?.type, primary?.value, primary?.modes);
}`,
} as const;
