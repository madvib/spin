import { resolve } from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "../../packages/preset/src/plugin.ts";
import { mountSpinApp } from "../../packages/api/src/index.ts";
import carbon from "@iconify-json/carbon/icons.json" with { type: "json" };
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import materialSymbols from "@iconify-json/material-symbols/icons.json" with {
  type: "json",
};
import ph from "@iconify-json/ph/icons.json" with { type: "json" };
import tabler from "@iconify-json/tabler/icons.json" with { type: "json" };
import studioTheme from "./theme.json" with { type: "json" };
export default defineConfig(({ command }) => ({
  // The bundle is served under `/__spin/studio/`: absolute asset paths
  // would escape the mount and 404 behind the middleware. Dev serves at
  // `/` so routes resolve without the prefix.
  base: command === "build" ? "/__spin/studio/" : "/",
  plugins: [
    spin.vite({
      // The chrome is themed by the studio's own static theme. Project
      // themes are injected at runtime by the preview surface, so editing one
      // cannot restyle the tool doing the editing.
      themes: { studio: studioTheme },
      // The studio mounts its own API for dev, and must not then inject a
      // launcher into itself: that is a FAB opening the studio over the studio.
      launcher: false,
      // The five collections the icons page reads and the chrome spends from:
      // the same catalogues the API serves, so a utility the page copies
      // resolves against what the studio actually ships. A rule per glyph is
      // generated only for a name somebody wrote down — the page renders
      // inline SVG and safelists none of the 44k.
      presets: [
        presetIcons({
          collections: {
            lucide,
            "material-symbols": materialSymbols,
            tabler,
            carbon,
            ph,
          } as never,
        }),
      ],
      // The project under edit. In development that is the reference
      // app: a real spin app with `spin/*.json` on disk, which is the
      // same themes it renders — so what the studio edits is what the
      // app shows.
      mount: mountSpinApp(resolve(import.meta.dirname, "../../apps/reference")),
      content: {
        filesystem: [
          "src/**/*.{tsx,ts}",
          // Primitives register their demo markup through the daemon, so the
          // studio's Uno scan cannot see a class written in an example to
          // generate a rule for it - which is exactly how component icons came
          // to render nothing. Scanning the example modules brings the real
          // glyph names into the studio's sheet. Mirrors the reference app.
          resolve(
            import.meta.dirname,
            "../../packages/preset/src/rules/primitives/*.examples.ts",
          ),
        ],
        pipeline: {
          include: [
            /\.(tsx?|html)($|\?)/,
          ],
          // Demos are the component viewer's content, rendered as markup
          // strings and registered through the preview surface's own scan —
          // a route's markup on screen would be scanned twice. Everything
          // else, routes included, is this app's own chrome: excluding
          // `/routes/` meant no route's markup reached the chrome sheet, so
          // `<h1>` on a page never got a heading rule.
        },
      },
    }),
    // The studio is a static bundle served by the middleware: no SSR,
    // no server functions, no second process. The browser dials the same
    // origin the bundle was served from, which is the whole point.
    solid(),
  ],
  resolve: {
    alias: [
      // Longest match first: a bare `@spin/theme` alias is a prefix match and
      // would otherwise swallow `@spin/theme/base`.
      {
        find: "@spin/theme/base",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/theme/src/base/index.ts",
        ),
      },
      {
        find: /^@spin\/theme\/(.+)$/,
        replacement: resolve(
          import.meta.dirname,
          "../../packages/theme/src/$1",
        ),
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
        find: "@spin/preset",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/preset/src/index.ts",
        ),
      },
      {
        find: "@spin/api",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/api/src/index.ts",
        ),
      },
      { find: /^npm:(.+)$/, replacement: "$1" },
      {
        find: "@unocss/core",
        replacement: resolve(
          import.meta.dirname,
          "node_modules/@unocss/core/dist/index.mjs",
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
      ],
    },
  },
}));
