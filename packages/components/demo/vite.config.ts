import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import UnoCSS from "@unocss/vite";
import { spinPreset } from "../../preset/src/index.ts";
import { starterThemes } from "../../theme/src/themes/index.ts";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const rawHtml = (): Plugin => ({
  name: "spin/raw-html",
  enforce: "pre",
  async load(id) {
    if (id.endsWith(".html?raw")) {
      const path = id.slice(0, -4);
      const source = await (await import("node:fs/promises")).readFile(path, "utf8");
      return `export default ${JSON.stringify(source)};`;
    }
    return undefined;
  },
});

export default defineConfig({
  plugins: [rawHtml(), UnoCSS({ presets: [spinPreset({ themes: { default: starterThemes.default } })] })],
  build: {
    rollupOptions: {
      input: {
        main: at("./index.html"),
        accordion: at("./accordion.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@spin/components": at("../src/index.ts"),
      "@spin/components/accordion": at("../src/accordion/index.ts"),
      "@spin/runtime/zag": at("../../runtime/src/machine/adapter/index.ts"),
      "@spin/runtime/load": at("../../runtime/src/directives/load.ts"),
      "@spin/runtime": at("../../runtime/src/index.ts"),
      "@spin/preset": at("../../preset/src/index.ts"),
      "@spin/theme/themes": at("../../theme/src/themes/index.ts"),
      "@spin/theme": at("../../theme/src/index.ts"),
    },
  },
});
