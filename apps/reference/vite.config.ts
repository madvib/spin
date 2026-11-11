import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "@spinjs/spin/vite";
import { starterThemes } from "@spinjs/theme/themes";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
const here = import.meta.dirname!;

/**
 * `spin.vite` is the whole toolchain: it globs, generates, safelists
 * the catalog so the utilities the pages choose from the catalog at
 * runtime still have a rule to demonstrate them with, and carries the
 * specifier table — no app keeps a copy of the resolution.
 */

/**
 * The reference's own compositions.
 *
 * Spin ships none of its own, so the reference declares the compositions
 * its surfaces repeat. The lint reads this file, so a class the reference
 * declares is a class the lint knows.
 */
const referenceShortcuts: Record<string, string> = {
  /** A column of items with a consistent gap. */
  "stack-sm": "flex flex-col gap-2",
  "stack-xs": "flex flex-col gap-1",
  stack: "flex flex-col gap-4",
  /** A horizontal row of items. */
  "row-sm": "flex items-center gap-2",
  row: "flex items-center gap-4",
  /** A row that gives its ends to their owners. */
  split: "flex items-center justify-between gap-4",
};

export default defineConfig({
  plugins: [
    solid(),
    spin.vite({
      // The reference renders every starter, forked by `spin/*.json` at
      // this root — the same files the studio edits — so a theme change
      // in the studio re-themes this app. Starters arrive as values
      // through `extends`, never by silent merge.
      extends: { themes: starterThemes },
      shortcuts: referenceShortcuts,
      presets: [presetIcons({ collections: { lucide } as never })],
      // Example modules carry the tokens (App → primitives registry →
      // package examples). Filesystem scanning reads them directly; the
      // pipeline include admits plain .ts because examples are data
      // modules, not components.
      content: {
        filesystem: [
          resolve(here, "src/**/*.{tsx,ts}"),
        ],
        pipeline: {
          include: [
            /\.(tsx?|html)($|\?)/,
          ],
        },
      },
    }),
  ],
});
