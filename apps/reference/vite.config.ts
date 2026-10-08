import { resolve } from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import solid from "vite-plugin-solid";
import UnoCSS from "@unocss/vite";
import presetIcons from "@unocss/preset-icons";
import { describeCatalog, spinPreset } from "../../packages/preset/src/index.ts";
import { parseTokens } from "../../packages/theme/src/index.ts";
import { starterThemes } from "../../packages/theme/src/themes/index.ts";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };

const here = import.meta.dirname!;

// The reference renders package examples directly in Solid, so the module
// graph carries every class a PRIMITIVE example wears. The UTILITIES pages
// are different: a rail, a scale step and a swatch choose their class from
// the catalog at RUNTIME, so the scanner never sees them — `pl-8` and
// `bg-secondary` exist only as values, and without a rule the specimen
// renders unstyled and looks like a broken utility. Safelisting the catalog
// is the drift-free equivalent of the old content dir: the sheet is
// generated from the same source the pages are, so a utility the catalog
// names always has a rule to demonstrate it with.
const parsed = parseTokens(
  starterThemes.default as unknown as Parameters<typeof parseTokens>[0],
);
if (!parsed.ok) throw new Error(parsed.error);
const utilitySafelist = describeCatalog(parsed.tree).flatMap((section) =>
  section.utilities
);

export default defineConfig({
  plugins: [
    solid(),
    UnoCSS({
      presets: [
        presetIcons({ collections: { lucide } as never }),
        spinPreset({ themes: starterThemes }),
      ],
      safelist: utilitySafelist,
      // Example modules carry the tokens (App → primitives registry →
      // package examples). Filesystem scanning reads them directly; the
      // pipeline include admits plain .ts because examples are data
      // modules, not components.
      content: {
        filesystem: [
          resolve(here, "../../packages/preset/src/rules/primitives/*.examples.ts"),
          resolve(here, "src/**/*.{tsx,ts}"),
        ],
        pipeline: {
          include: [/\.(vue|svelte|[jt]sx?|vine.ts|mdx?|astro|elm|php|phtml|marko|html)($|\?)/],
        },
      },
    }),
  ],
  resolve: {
    alias: [
      {
        find: "@spin/theme/base",
        replacement: resolve(
          here,
          "../../packages/theme/src/base/index.ts",
        ),
      },
      {
        find: /^@spin\/theme\/(.+)$/,
        replacement: resolve(here, "../../packages/theme/src/$1"),
      },
      {
        find: "@spin/theme",
        replacement: resolve(
          here,
          "../../packages/theme/src/index.ts",
        ),
      },
      {
        find: "@spin/animation",
        replacement: resolve(
          here,
          "../../packages/animation/src/index.ts",
        ),
      },
      {
        find: "@spin/primitives-procedures",
        replacement: resolve(
          here,
          "../../packages/preset/src/primitives-procedures.ts",
        ),
      },
      {
        find: /^@spin\/preset\/(.+)$/,
        replacement: resolve(here, "../../packages/preset/src/$1"),
      },
      {
        find: "@spin/preset",
        replacement: resolve(
          here,
          "../../packages/preset/src/index.ts",
        ),
      },
      { find: /^npm:(.+)$/, replacement: "$1" },
      {
        find: "@unocss/core",
        replacement: resolve(
          here,
          "../../node_modules/@unocss/core/dist/index.mjs",
        ),
      },
    ],
  },
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        "/__uno.css",
        "/__uno.css?inline",
        "/@unocss",
      ],
    },
  },
});
