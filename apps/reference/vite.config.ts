import { resolve } from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import UnoCSS from "@unocss/vite";
import presetIcons from "@unocss/preset-icons";
import { spinPreset } from "../../packages/preset/src/index.ts";
import { starterThemes } from "../../packages/theme/src/themes/index.ts";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import handler from "./src/routes.ts";

// The reference renders its content at REQUEST time (string renderers behind
// a middleware), so the scanner never sees a class it demonstrates in the
// sources. `build-content.ts` renders every route to a static page under
// `src/content/` before the scanner runs, and the scanner reads those files:
// utilities, primitives and chrome all reach the sheet from real markup.
// Nothing is hand-listed here — a primitive token comes from the element
// seeing `<button class="secondary">`, which no catalog could produce.

export default defineConfig({
  plugins: [
    UnoCSS({
      presets: [
        presetIcons({ collections: { lucide } as never }),
        spinPreset({ themes: starterThemes }),
      ],
      content: {
        // The rendered pages are imported by no module, so the module graph
        // cannot find them: `filesystem` is what makes the scanner read the
        // generated markup. The pipeline `include` default already admits
        // `.html`.
        filesystem: ["src/content/**/*.html"],
      },
    }),
    {
      name: "reference-server",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/__uno") || req.url?.startsWith("/@uno")) {
            next();
            return;
          }
          handler(req, res);
        });
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: "@spin/theme/base",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/theme/src/base/index.ts",
        ),
      },
      {
        find: /^@spin\/theme\/(.+)$/,
        replacement: resolve(import.meta.dirname, "../../packages/theme/src/$1"),
      },
      {
        find: "@spin/theme",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/theme/src/index.ts",
        ),
      },
      {
        find: "@spin/animation",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/animation/src/index.ts",
        ),
      },
      {
        find: "@spin/primitives-procedures",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/preset/src/primitives-procedures.ts",
        ),
      },
      {
        find: /^@spin\/preset\/(.+)$/,
        replacement: resolve(import.meta.dirname, "../../packages/preset/src/$1"),
      },
      {
        find: "@spin/preset",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/preset/src/index.ts",
        ),
      },
      { find: /^npm:(.+)$/, replacement: "$1" },
      {
        find: "@unocss/core",
        replacement: resolve(
          import.meta.dirname,
          "../../node_modules/@unocss/core/dist/index.mjs",
        ),
      },
    ],
  },
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        "/__uno.css",
        "/__uno.css?inline",
        "/@unocss",
      ],
    },
  },
});
