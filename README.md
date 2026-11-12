# Spin

Design tokens, styled HTML elements, layout utilities, and portable UI statecharts for modern web apps.

> **Status: Public Alpha (`0.2.0-alpha.1`)** — Core architecture, Theme Studio, HTML primitives, layout utilities, and 40 interactive components work today under the MIT license. Expect minor API and token refinements before 1.0.

## Why Spin

Frontend stacks usually split UI across three disconnected layers: a utility CSS library, a headless widget kit, and a custom theme file held together by code review. Spin unifies them without locking you into a framework-specific component black box:

- **Theme Studio** — Pick a starting design language, shape your palette, typography, spacing, and dark mode visually against live components, and save git-friendly JSON files to `spin/`.
- **Styled HTML elements** — Standard tags (`<button>`, `<input>`, `<dialog>`, `<table>`) and lightweight custom surfaces (`<card>`, `<badge>`, `<alert>`) arrive styled from your theme with zero client JS.
- **Layout utilities** — Arrange screens with familiar flexbox, grid, spacing, surface, and radius classes backed by your theme scale. Unknown classes fail loudly instead of silently doing nothing.
- **Portable statechart components** — Copy accessible templates for selects, comboboxes, menus, tabs, date pickers, and floating panels into your repository and bind them in React, Solid, Vue, Svelte, or plain HTML.
- **Static checks & MCP server** — Built-in lints verify contrast ratios and catch conflicting overrides in your editor and CI, while the MCP server exposes your live tokens and components to coding agents.

## Quickstart

```sh
npm install -D @spinjs/dev
npm install @spinjs/components
npx spin init
```

Wire the plugin in `vite.config.ts` (Rspack, webpack, Rollup, Rolldown, esbuild, Bun, and UnoCSS are also supported):

```ts
import { spin } from "@spinjs/dev/vite";

export default {
  plugins: [spin.vite()],
};
```

Import the virtual stylesheet once in your app entry (`import "spin/styles.css";`), start your dev server (or run `npx spin studio`), and write clean HTML.

## Packages

| Package | Install as | Description |
| --- | --- | --- |
| [`@spinjs/dev`](packages/dev) | `devDependency` | Bundler plugins, UnoCSS preset, theme compiler, Studio, CLI (`spin`), LSP, lints, and MCP server. |
| [`@spinjs/components`](packages/components) | `dependency` | Headless statechart machines, client runtime, and React, Solid, Vue, Svelte, and DOM adapters. |

## Repository layout

- `packages/dev` & `packages/components` — The two published npm packages (`packages/{theme,preset,diagnostics,server,build}` are internal workspace layers bundled into `@spinjs/dev`).
- `apps/studio` — Visual brand and theme editor.
- `apps/docs` — Documentation site, component catalog, and 5-framework interactive Playground.
- `apps/reference` — Visual regression and contract reference app.
- `examples/coffee` — Example storefront app built with Spin.

## Local development

Requires [Bun](https://bun.sh) (`>= 1.3`).

```sh
bun install
bun run dev:docs     # Start docs site + Playground locally
bun run dev          # Start standalone Studio + API daemon
bun run check        # Typecheck all packages/apps + run Spin lints
bun run test         # Run unit and integration test suites
bun run build:dist   # Build publishable dist/ bundles and verify export maps
```

## License

[MIT](LICENSE)
