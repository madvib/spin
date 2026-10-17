import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "../../packages/preset/src/plugin.ts";
import { mountSpinApp } from "../../packages/api/src/index.ts";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };

const here = import.meta.dirname!;

/**
 * `spin.vite` is the whole toolchain: it globs, generates, safelists
 * the catalog so the utilities the pages choose from the catalog at
 * runtime still have a rule to demonstrate them with, and carries the
 * specifier table — no app keeps a copy of the resolution.
 */

export default defineConfig({
  plugins: [
    solid(),
    spin.vite({
      // No `themes`: the project owns them. `spin/*.json` at this root —
      // the same files the studio edits — so a theme change in the studio
      // re-themes this app and nothing has to be re-imported.

      presets: [presetIcons({ collections: { lucide } as never })],
      // The studio bundle, built by `apps/studio/deno task build`. Absent
      // until built — the mount skips it rather than failing the server.
      mount: mountSpinApp(here, {
        studioDir: resolve(here, "../studio/dist"),
      }),
      // Example modules carry the tokens (App → primitives registry →
      // package examples). Filesystem scanning reads them directly; the
      // pipeline include admits plain .ts because examples are data
      // modules, not components.
      content: {
        filesystem: [
          resolve(
            here,
            "../../packages/preset/src/rules/primitives/*.examples.ts",
          ),
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
