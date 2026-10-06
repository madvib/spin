import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import UnoCSS from "@unocss/vite";
import { spinPreset } from "../../preset/src/index.ts";
import { starterThemes } from "../../theme/src/themes/index.ts";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [UnoCSS({ presets: [spinPreset({ themes: { default: starterThemes.default } })] })],
  resolve: {
    alias: {
      "@spin/components": at("../src/index.ts"),
      "@spin/runtime/zag": at("../../runtime/src/adapter/index.ts"),
      "@spin/runtime": at("../../runtime/src/index.ts"),
      "@spin/preset": at("../../preset/src/index.ts"),
      "@spin/theme/themes": at("../../theme/src/themes/index.ts"),
      "@spin/theme": at("../../theme/src/index.ts"),
    },
  },
});
