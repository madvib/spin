import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { spin } from "../../packages/preset/src/plugin.ts";
import { mountSpinApp } from "../../packages/api/src/index.ts";
import { starterThemes } from "../../packages/theme/src/themes/index.ts";

const here = import.meta.dirname!;

/**
 * The docs eat the product's own food.
 *
 * Themes come from `@spin/theme/themes` — the shipped registry, not copies
 * on disk. A starter fixed in the package re-themes this site on the next
 * build, and the site demos its default posture honestly: `widow`, dark or
 * paper, chosen from the header switcher. No `resolve` block: the plugin
 * carries the specifier table.
 */
export default defineConfig({
  plugins: [
    solid(),
    spin.vite({
      themes: { ...starterThemes },
      // The studio, same as the reference: the FAB the overlay launcher
      // drops into every served app opens this site's own theme documents.
      mount: mountSpinApp(here, {
        studioDir: resolve(here, "../studio/dist"),
      }),
      content: {
        filesystem: [
          // The examples carry the classes a consumer writes; scanning them
          // directly is what makes the rendered rows resolve without a
          // safelist of our own.
          resolve(
            here,
            "../../packages/preset/src/rules/primitives/*.examples.ts",
          ),
          resolve(here, "src/**/*.{tsx,ts}"),
          // The shared kit styles itself with the same vocabulary; scan it
          // so the picker's classes exist in the sheet.
          resolve(here, "../../packages/kit/src/**/*.{tsx,ts}"),
        ],
      },
    }),
  ],
});
