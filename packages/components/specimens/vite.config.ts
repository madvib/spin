import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import UnoCSS from "@unocss/vite";
import presetIcons from "@unocss/preset-icons";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import { spinElements } from "@spin/runtime/plugin/elements";
import { spinPreset } from "../../preset/src/index.ts";
import { starterThemes } from "../../theme/src/themes/index.ts";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [
    // `enforce: "pre"`: the element transform owns the `.html` component files
    // before Solid's babel pass ever sees them.
    spinElements({}),
    solid(),
    UnoCSS({
      presets: [
        presetIcons({ collections: { lucide } as never }),
        spinPreset({ themes: starterThemes }),
      ],
    }),
  ],
  resolve: {
    alias: {
      "@spin/components": at("../src/index.ts"),
      "@spin/runtime/props": at("../../runtime/src/props.ts"),
      "@spin/runtime/fsm": at("../../runtime/src/machine/fsm/machine.ts"),
      "@spin/runtime/load": at("../../runtime/src/directives/load.ts"),
      "@spin/runtime/actions": at("../../runtime/src/actions/index.ts"),
      "@spin/runtime": at("../../runtime/src/index.ts"),
      // Subpath aliases only — no base `@spin/hooks` entry: a base entry
      // prefix-collides with the subpaths (`<file>/solid`) and wins.
      "@spin/hooks/solid": "/home/madvib/dev/spin-runtime/packages/hooks/src/solid.ts",
      "@spin/hooks/react": "/home/madvib/dev/spin-runtime/packages/hooks/react.ts",
      "@spin/preset": at("../../preset/src/index.ts"),
      "@spin/theme/themes": at("../../theme/src/themes/index.ts"),
      "@spin/theme": at("../../theme/src/index.ts"),
    },
  },
});
