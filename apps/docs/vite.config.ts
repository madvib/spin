import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "@spinjs/spin/vite";
import { demoPalettes, demoSpacings, designLanguages } from "@spinjs/theme";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import { jibeIsolation, jibeStudio } from "./tooling/plugins/jibe.ts";
import { markdownForAgents } from "./tooling/plugins/markdown-for-agents.ts";

const here = import.meta.dirname!;
const STUDIO_ROOT = resolve(here, "../studio/dist");

export default defineConfig({
  plugins: [
    jibeIsolation(),
    jibeStudio({ docsRoot: here, studioRoot: STUDIO_ROOT }),
    solid(),
    markdownForAgents(),
    spin.vite({
      extends: {
        themes: designLanguages,
        palettes: demoPalettes,
        spacings: demoSpacings,
      },
      /*
       * The docs' own compositions, declared inline because the project
       * reader takes them from this file's text: the lint and the reference
       * both spend this table, so an indirection through a constant would
       * silently empty the project's vocabulary.
       */
      shortcuts: {
        "stack-sm": "flex flex-col gap-2",
        "stack-xs": "flex flex-col gap-1",
        stack: "flex flex-col gap-4",
        "row-sm": "flex items-center gap-2",
        row: "flex items-center gap-4",
        split: "flex items-center justify-between gap-4",
      },
      presets: [presetIcons({ collections: { lucide } as never })],
      content: {
        filesystem: [
          resolve(here, "src/**/*.{tsx,ts}"),
          resolve(here, "src/lib/components/**/*.html"),
        ],
        pipeline: {
          include: [/\.(tsx?|html)($|\?)/],
        },
      },
    }),
  ],
});
