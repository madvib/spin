import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import UnoCSS from "@unocss/vite";
import { spinElements } from "/home/madvib/dev/spin-runtime/packages/runtime/src/plugin/elements.ts";
import { spinPreset } from "/home/madvib/dev/spin-runtime/packages/preset/src/index.ts";
import { starterThemes } from "/home/madvib/dev/spin-runtime/packages/theme/src/themes/index.ts";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: at("."),
  build: { outDir: at("./dist") },
  plugins: [
    spinElements({}),
    solid(),
    UnoCSS({ presets: [spinPreset({ themes: { default: starterThemes.default } })] }),
  ],
  resolve: {
    alias: {
      "@spin/components": "/home/madvib/dev/spin-runtime/packages/components/src/index.ts",
      "@spin/runtime/zag": "/home/madvib/dev/spin-runtime/packages/runtime/src/machine/adapter/index.ts",
      "@spin/runtime/fsm": "/home/madvib/dev/spin-runtime/packages/runtime/src/machine/fsm/fsm.ts",
      "@spin/runtime/load": "/home/madvib/dev/spin-runtime/packages/runtime/src/directives/load.ts",
      "@spin/runtime": "/home/madvib/dev/spin-runtime/packages/runtime/src/index.ts",
      "@spin/hooks/solid": "/home/madvib/dev/spin-runtime/packages/hooks/src/solid.ts",
      "@spin/hooks/react": "/home/madvib/dev/spin-runtime/packages/hooks/src/react.ts",
      "@spin/preset": at("../preset/src/index.ts"),
      "@spin/theme/themes": at("../theme/src/themes/index.ts"),
      "@spin/theme": "/home/madvib/dev/spin-runtime/packages/theme/src/index.ts",
      "robot3": "/home/madvib/dev/spin-runtime/node_modules/robot3/dist/machine.js",
    },
  },
});
