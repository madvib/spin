import { resolve } from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import UnoCSS from "@unocss/vite";
import presetIcons from "@unocss/preset-icons";
import { spinPreset } from "../../packages/preset/src/index.ts";
import { describeCatalog } from "../../packages/preset/src/index.ts";
import { parseTokens } from "../../packages/theme/src/index.ts";
import { starterThemes } from "../../packages/theme/src/themes/index.ts";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import handler from "./src/routes.ts";

// The reference renders its content at REQUEST time (string renderers behind
// a middleware), so the scanner never sees a class it demonstrates — file
// scanning finds the chrome, not the specimens. The catalog is the safelist
// instead: every utility it names is generated, exactly as studio's preview
// does with previewCss(). A class the catalog drops stops generating, which
// is the honest behaviour — the rail renders it with a "no CSS" label.
// Fixture/chrome/demo classes reach the sheet through the scanner (static
// files) or the safelist below; nothing is hand-listed per page.
const parsed = parseTokens(starterThemes.default);
if (!parsed.ok) throw new Error(parsed.error);
const safelist = describeCatalog(parsed.tree).flatMap((s) => s.utilities);

export default defineConfig({
  plugins: [
    UnoCSS({
      presets: [
        presetIcons({ collections: { lucide } as never }),
        spinPreset({ themes: starterThemes }),
      ],
      safelist,
      content: {
        pipeline: {
          exclude: [
            /components\/demos\//,
            /\/routes\//,
          ],
        },
      },
    }),
    {
      name: "reference-server",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/__uno") || req.url?.startsWith("/@uno")) {
            next();
            return;
          }
          handler(req, res);
        });
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: "@spin/theme/base",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/theme/src/base/index.ts",
        ),
      },
      {
        find: /^@spin\/theme\/(.+)$/,
        replacement: resolve(import.meta.dirname, "../../packages/theme/src/$1"),
      },
      {
        find: "@spin/theme",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/theme/src/index.ts",
        ),
      },
      {
        find: "@spin/animation",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/animation/src/index.ts",
        ),
      },
      {
        find: "@spin/primitives-procedures",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/preset/src/primitives-procedures.ts",
        ),
      },
      {
        find: /^@spin\/preset\/(.+)$/,
        replacement: resolve(import.meta.dirname, "../../packages/preset/src/$1"),
      },
      {
        find: "@spin/preset",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/preset/src/index.ts",
        ),
      },
      {
        find: /^@spin\/server\/(.+)$/,
        replacement: resolve(import.meta.dirname, "../../server/$1"),
      },
      { find: /^npm:(.+)$/, replacement: "$1" },
      {
        find: "@unocss/core",
        replacement: resolve(
          import.meta.dirname,
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
