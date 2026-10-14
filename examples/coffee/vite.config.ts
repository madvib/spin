import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "../../packages/preset/src/plugin.ts";
import { mountSpinApp } from "../../packages/api/src/index.ts";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };

const here = import.meta.dirname!;

/**
 * The example app's whole config.
 *
 * `spin.vite` is the toolchain: it globs these sources, generates the
 * stylesheet, and mounts the API and the studio on the same origin. No
 * `themes` — `spin/roastery.json` at this root is the theme, the same file
 * the studio edits, so there is one source and it is on disk where a
 * customer can see it.
 */
export default defineConfig({
  plugins: [
    solid(),
    spin.vite({
      presets: [presetIcons({ collections: { lucide } as never })],
      apiBase: "/__spin",
      mount: mountSpinApp(here, { studioDir: resolve(here, "../../apps/studio/dist") }),
      content: {
        filesystem: ["src/**/*.{tsx,ts}"],
        pipeline: {
          include: [/\.(vue|svelte|[jt]sx?|mdx?|astro|html)($|\?)/],
        },
      },
    }),
  ],
});
