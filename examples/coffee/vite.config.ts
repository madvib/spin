import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "../../packages/dev/src/plugin/plugin.ts";
import { mountSpinApp } from "../../packages/dev/src/api/index.ts";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };

const here = import.meta.dirname!;

/** The example app's whole config.
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
      // The studio, while it is being worked on. SPIN_STUDIO_DEV points at
      // the studio's own dev server (the one in apps/studio), and the
      // overlay's frame loads it from there: an edit in the studio reloads
      // the frame, instead of needing a rebuild, a restart and a cache clear.
      // Without it the frame loads the built bundle mounted beside the API —
      // the studio in apps/studio/dist — and editing the studio is a rebuild,
      // a restart and a cache clear per change.
      ...(process.env.SPIN_STUDIO_DEV !== undefined
        ? { studioUrl: process.env.SPIN_STUDIO_DEV }
        : {}),
      mount: mountSpinApp(here, {
        studioDir: resolve(here, "../../apps/studio/dist"),
      }),
      content: {
        filesystem: ["src/**/*.{tsx,ts}"],
        pipeline: {
          include: [/\.(vue|svelte|[jt]sx?|mdx?|astro|html)($|\?)/],
        },
      },
    }),
  ],
});
