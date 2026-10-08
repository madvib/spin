import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import UnoCSS from "@unocss/vite";
import { spinPreset } from "../../preset/src/index.ts";
import { starterThemes } from "../../theme/src/themes/index.ts";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

import { spinElements } from "@spin/runtime/plugin/elements";

export default defineConfig({
  plugins: [spinElements({}), UnoCSS({ presets: [spinPreset({ themes: { default: starterThemes.default } })] })],
  build: {
    rollupOptions: {
      input: {
        main: at("./index.html"),
        "spin-accordion": at("./spin-accordion.html"),
        "spin-popover": at("./spin-popover.html")
      },
    },
  },
  resolve: {
    alias: {
      "@spin/components": at("../src/index.ts"),
      "@spin/runtime/zag": at("../../runtime/src/machine/adapter/index.ts"),
      "@spin/runtime/load": at("../../runtime/src/directives/load.ts"),
      "@spin/runtime": at("../../runtime/src/index.ts"),
      "@spin/preset": at("../../preset/src/index.ts"),
      "@spin/theme/themes": at("../../theme/src/themes/index.ts"),
      "@spin/theme": at("../../theme/src/index.ts"),
    },
  },
});
