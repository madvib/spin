import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import UnoCSS from "@unocss/vite";
import { spinElements } from "@spin/runtime/plugin/elements";
import { spinPreset } from "../../preset/src/index.ts";
import { starterThemes } from "../../theme/src/themes/index.ts";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // The element plugin rewrites every non-node_modules `.html` import to
  // `?spin-element`, and the rolldown dep scanner cannot load that id. With no
  // entries it skips discovery and optimizes each dependency on demand.
  optimizeDeps: { entries: [] },
  plugins: [
    // `enforce: "pre"`: the element transform owns the `.html` component files
    // before Solid's babel pass ever sees them.
    spinElements({}),
    solid(),
    UnoCSS({ presets: [spinPreset({ themes: { default: starterThemes.default } })] }),
  ],
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
