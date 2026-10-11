import { resolve } from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import { nitro } from "nitro/vite";
import { solidStart } from "@solidjs/start/config";
import UnoCSS from "@unocss/vite";
import presetIcons from "@unocss/preset-icons";
import { spinPreset } from "../../packages/preset/src/index.ts";
import studioTheme from "./theme.json" with { type: "json" };
export default defineConfig({
  plugins: [
    UnoCSS({
      presets: [
        presetIcons(),
        // The chrome is themed by the studio's own static theme. Project
        // themes are injected at runtime by the preview surface, so editing one
        // cannot restyle the tool doing the editing.
        spinPreset({ themes: { studio: studioTheme } }),
      ],
      content: {
        pipeline: {
          exclude: [
            /components\/demos\//,
            /\/routes\//,
          ],
        },
      },
    }),
    // The studio is an authenticated tool, not a page: nothing here is
    // crawlable and nothing needs a server-rendered first paint. Rendering on
    // the server would mean the page cannot load without the daemon answering
    // an HTTP fetch mid-render, which couples the studio's uptime to a process
    // the client can equally well talk to. Client-only is the boring shape.
    solidStart({ ssr: false }),
    nitro(),
  ],
  resolve: {
    alias: [
      // Longest match first: a bare `@spin/theme` alias is a prefix match and
      // would otherwise swallow `@spin/theme/base`.
      {
        find: "@spin/theme/base",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/theme/src/base/index.ts",
        ),
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
        find: "@spin/preset",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/preset/src/index.ts",
        ),
      },
      {
        find: "@spin/api",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/api/src/index.ts",
        ),
      },
      { find: /^npm:(.+)$/, replacement: "$1" },
      {
        find: "@unocss/core",
        replacement: resolve(
          import.meta.dirname,
          "node_modules/@unocss/core/dist/index.mjs",
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
