import { resolve } from "node:path";
import { defineConfig } from "vite";
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

/**
 * The studio's own compositions.
 *
 * These are the decisions every page of this app makes: stack things
 * vertically with a gap, put things beside each other, hold a control rail
 * beside a surface. Written out each time they are `flex flex-col gap-4`
 * and `flex gap-4` — repeated in eight files, and the repetition is why the
 * app looks generic.
 *
 * They are NOT primitives and NOT tokens. A token is a value; a primitive
 * carries base on a semantic tag. A shortcut consumes both and commits to a
 * composition, which is a third thing: quality of life that keeps one
 * page's spacing from drifting from the next one's.
 *
 * So they live here, in the studio's own configuration: the vocabulary an
 * app composes is the app's decision, and spin does not forbid a project
 * from composing its own. What they SPEND is still the theme's — a gap of
 * `gap-4` is the theme's spacing step, so a theme that prefers roomier
 * sections sets it once and every composition follows.
 */
const studioShortcuts = {
  /** A column of things, one gap apart. */
  "stack": "flex flex-col gap-4",
  /** The same column, close together. */
  "stack-sm": "flex flex-col gap-2",
  /** The same column, with room between. */
  "stack-lg": "flex flex-col gap-8",
  /** A row of things, on one line. */
  "row": "flex items-center gap-4",
  /** The same row, close together. */
  "row-sm": "flex items-center gap-2",
  /** A row that gives its ends to their owners. */
  "split": "flex items-center justify-between gap-4",
  /** A raised surface: the theme's fill, edge, corners and air. */
  "panel": "bg-surface-raised border border-border rounded-md p-6",
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
