import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "@spinjs/spin/vite";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
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
  // Assets resolve against the index that requested them, so the one bundle
  // serves both the plugin's `/__spin/studio/` mount and the standalone
  // daemon's `/studio/`. A baked prefix 404s at the other mount.
  base: command === "build" ? "./" : "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@unocss") || id.includes("packages/spin/src/preset")) {
            return "preset";
          }
          if (id.includes("packages/spin/src/theme")) {
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
      "@spinjs/diagnostics": resolve(
        import.meta.dirname,
        "src/lib/diagnostics-stub.ts",
      ),
    },
  },
  plugins: [
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
      // The studio is the tool, not its own target: no mount, no
      // launcher — a FAB opening the studio over the studio helps no
      // one. Its API comes from its own dev entry, not the plugin.
      studio: false,
      // The lucide collection the chrome spends glyphs from: `i-lucide-*`
      // is the only icon utility the scanned chrome uses. The other four
      // collections the daemon serves reach the icons page over RPC as
      // glyph bodies, not as CSS — no rule is safelisted for the 44k, and
      // the page renders the returned markup as inline SVG. A rule per
      // glyph is generated only for a name somebody wrote down.
      presets: [
        presetIcons({
          collections: {
            lucide,
          } as never,
        }),
      ],
      // The project under edit — the reference app, a real spin app
      // with `spin/*.json` on disk — is named by the dev entry's own
      // mount, not the plugin: `studio: false` above disables this
      // mount, so what the studio edits is what the app shows without
      // the plugin injecting a launcher into its own tool.
      content: {
        filesystem: [
          // The file the compositions are declared in. A class written down
          // there and nowhere else is a class nothing generates — the sheet
          // only carries what the scan saw — so the declaration is scanned
          // with the markup that uses it.
          "vite.config.ts",
          "src/**/*.{tsx,ts}",
          "lib/components/**/*.{html,ts}",
          "../../packages/spin/src/kit/**/*.{tsx,ts}",
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
