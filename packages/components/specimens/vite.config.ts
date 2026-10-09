import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import UnoCSS from "@unocss/vite";
import { spinElements } from "@spin/runtime/plugin/elements";
import { spinPreset } from "../../preset/src/index.ts";
import { starterThemes } from "../../theme/src/themes/index.ts";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Build-time interpreter swap: `SPIN_ACCORDION=robot` compiles the robot3
  // accordion in and dead-code-eliminates Zag's (and vice versa), so bundle
  // sizes stay honest. `process.env` does not exist in the browser — a
  // runtime check would ship both interpreters and always run Zag.
  define: {
    __SPIN_ROBOT_ACCORDION__: JSON.stringify(process.env["SPIN_ACCORDION"] === "robot"),
  },
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
      "@spin/runtime/fsm": at("../../runtime/src/machine/fsm/fsm.ts"),
      "@spin/runtime/load": at("../../runtime/src/directives/load.ts"),
      "@spin/runtime": at("../../runtime/src/index.ts"),
      // Subpath aliases only — no base `@spin/hooks` entry: a base entry
      // prefix-collides with the subpaths (`<file>/solid`) and wins.
      "@spin/hooks/solid": "/home/madvib/dev/spin-runtime/packages/hooks/src/solid.ts",
      "@spin/hooks/react": "/home/madvib/dev/spin-runtime/packages/hooks/src/react.ts",
      "@spin/preset": at("../../preset/src/index.ts"),
      "@spin/theme/themes": at("../../theme/src/themes/index.ts"),
      "@spin/theme": at("../../theme/src/index.ts"),
      "robot3": at("../../../node_modules/robot3/dist/machine.js"),
    },
  },
});
