import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "@spinjs/dev/vite";
import { demoPalettes, demoSpacings, designLanguages } from "@spinjs/theme";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import { jibeIsolation, jibeStudio } from "./tooling/plugins/jibe.ts";
import { markdownForAgents } from "./tooling/plugins/markdown-for-agents.ts";

const here = import.meta.dirname!;
const STUDIO_ROOT = resolve(here, "../studio/dist");

export default defineConfig({
  resolve: {
    alias: {
      "@spinjs/kit": resolve(here, "../../internal/kit/src/index.ts"),
    },
  },
  plugins: [
    jibeIsolation(),
    jibeStudio({ docsRoot: here, studioRoot: STUDIO_ROOT }),
    solid(),
    markdownForAgents(),
    spin.vite({
      studio: false,
      extends: {
        themes: designLanguages,
        palettes: demoPalettes,
        spacings: demoSpacings,
      },
      // The docs' own compositions live in `spin/shortcuts.json` beside
      // the brands: the build compiles them and the lint judges them from
      // the one table.
      presets: [
        presetIcons({
          extraProperties: { display: "inline-block", "vertical-align": "middle" },
          collections: { lucide } as never,
        }),
      ],
      content: {
        filesystem: [
          resolve(here, "src/**/*.{tsx,ts}"),
          resolve(here, "src/lib/components/**/*.html"),
          resolve(here, "../../internal/kit/src/**/*.{tsx,ts}"),
          resolve(here, "../../packages/components/src/**/examples/*.html"),
          resolve(here, "../../packages/preset/src/rules/primitives/*.examples.ts"),
        ],
        pipeline: {
          include: [/\.(tsx?|html)($|\?)/],
        },
      },
    }),
  ],
});
