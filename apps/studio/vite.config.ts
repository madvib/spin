import { resolve } from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import solid from "vite-plugin-solid";
import presetIcons from "@unocss/preset-icons";
import { spin } from "../../packages/preset/src/plugin.ts";
import { mountSpinApp } from "../../packages/api/src/index.ts";
import studioTheme from "./theme.json" with { type: "json" };
export default defineConfig({
  // Built to be served under `/__spin/studio/`: absolute asset paths would
  // escape the mount and 404 behind the middleware.
  base: "/__spin/studio/",
  plugins: [
    spin.vite({
      // The chrome is themed by the studio's own static theme. Project
      // themes are injected at runtime by the preview surface, so editing one
      // cannot restyle the tool doing the editing.
      themes: { studio: studioTheme },
      presets: [presetIcons()],
      // The project under edit. In development that is the fixture app;
      // a consumer's own config points this at their project root.
      mount: mountSpinApp(
        resolve(import.meta.dirname, "../../examples/fixture-app"),
      ),
      content: {
        filesystem: ["src/**/*.{tsx,ts}"],
        pipeline: {
          include: [
            /\.(vue|svelte|[jt]sx?|vine.ts|mdx?|astro|elm|php|phtml|marko|html)($|\?)/,
          ],
          exclude: [
            /components\/demos\//,
            /\/routes\//,
          ],
        },
      },
    }),
    // The studio is a static bundle served by the middleware: no SSR,
    // no server functions, no second process. The browser dials the same
    // origin the bundle was served from, which is the whole point.
    solid(),
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
      ],
    },
  },
});
