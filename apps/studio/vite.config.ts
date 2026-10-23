import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spinElements } from "../../packages/runtime/src/plugin/elements.ts";
import { mountSpinApp } from "../../packages/api/src/index.ts";
import carbon from "@iconify-json/carbon/icons.json" with { type: "json" };
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import materialSymbols from "@iconify-json/material-symbols/icons.json" with {
  type: "json",
};
import ph from "@iconify-json/ph/icons.json" with { type: "json" };
import tabler from "@iconify-json/tabler/icons.json" with { type: "json" };
import studioTheme from "./theme.json" with { type: "json" };

/**
 * The studio's own compositions.
 *
 * The standard ones — `stack`, `row`, `split`, `panel`, `overline` — ship
 * with the preset, so every app that draws a page reads the same set. What is
 * here is the studio's own: the two drawer regions and the preview's scope.
 */
const studioShortcuts = {
  /**
   * The page's region: the room the shell gives it.
   *
   * Whether it scrolls is the page's own business — a page that brings its
   * own rail scrolls the pane instead — so the scroll stays at the call
   * site and only the frame is composed here.
   */
  "drawer-scroll": "min-h-0 min-w-0 flex-1",
  /**
   * The drawer's region: the host's frame scrolls the studio, so the region
   * grows with its content instead of scrolling inside itself.
   */
  "drawer-flow": "min-w-0 overflow-y-visible flex-none",
  /**
   * The preview's scope.
   *
   * The daemon writes the preview's sheet under `:where(.spin-preview)`, so
   * the class is a hook — the pane and every specimen carry it, and the
   * theme's rules land inside it and nowhere else. It composes nothing: a
   * hook is not a composition, and the pane's own frame is spelled out
   * where the pane is.
   *
   * It is declared here so the lint knows it. A class the studio marks
   * with is a class the studio produces, and the lint reads this file to
   * know which classes those are.
   */
  "spin-preview": "",
};

export default defineConfig(({ command }) => ({
  // The bundle is served under `/__spin/studio/`: absolute asset paths
  // would escape the mount and 404 behind the middleware. Dev serves at
  // `/` so routes resolve without the prefix.
  base: command === "build" ? "/__spin/studio/" : "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@unocss") || id.includes("packages/preset")) {
            return "preset";
          }
          if (id.includes("packages/theme")) {
            return "theme";
          }
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
  resolve: {
    // The browser cannot read a disk, and the diagnostics package reads the
    // project's files. The studio's bundle reaches it through the API, so
    // the studio stands a stand-in in its place: the browser never calls
    // the rules — it asks the daemon over RPC, and the daemon runs them.
    //
    // The alias is the studio's own, not the preset's: a consumer of the
    // preset must never be handed this file.
    alias: {
      "@spin/diagnostics": resolve(
        import.meta.dirname,
        "src/lib/diagnostics-stub.ts",
      ),
    },
  },
  plugins: [
    spinElements({ machines: resolve(import.meta.dirname, "../../packages/components/src") }),
    spin.vite({
      // The chrome is themed by the studio's own static theme. Project
      // themes are injected at runtime by the preview surface, so editing one
      // cannot restyle the tool doing the editing.
      themes: { studio: studioTheme },
      // The compositions the studio's own pages share. They are the
      // studio's vocabulary, so they are declared here and nowhere else —
      // and the lint reads them from this file, so a class the studio
      // declares is a class the lint knows.
      shortcuts: studioShortcuts,
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
          // The file the compositions are declared in. A class written down
          // there and nowhere else is a class nothing generates — the sheet
          // only carries what the scan saw — so the declaration is scanned
          // with the markup that uses it.
          "vite.config.ts",
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
          // The taxonomy names the glyph each element wears. The icon preset
          // generates a rule for a name that is written down and for no name
          // that is not, so the gallery's rows would draw nothing at all
          // without the names reaching the scanner. Mirrors the reference app.
          resolve(
            import.meta.dirname,
            "../../packages/preset/src/rules/primitives/categories.ts",
          ),
          // The kit's shared components carry classes too — a section, a
          // specimen, the theme picker — and a class the scan does not see is
          // a class the sheet does not carry. The kit is internal chrome, so
          // its source is part of every app's content.
          resolve(
            import.meta.dirname,
            "../../packages/kit/src/**/*.{tsx,ts}",
          ),
          // Machine component examples: `.html` files compiled by
          // spinElements above. Mirrors the reference app.
          resolve(
            import.meta.dirname,
            "../../packages/components/src/*/examples/*.html",
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
}));
