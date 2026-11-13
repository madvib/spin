# @spinjs/dev

The Spin toolchain: the bundler plugin, the theme engine, the Studio, the
CLI, the daemon API, the lint front ends, the LSP, and the MCP server. A
devDependency — it builds your app but never ships in it.

```sh
npm install -D @spinjs/dev
npm install @spinjs/components
```

```ts
import { spin } from "@spinjs/dev/vite";

export default {
  plugins: [spin.vite()],
};
```

One `spin.vite()` call wires the whole chain: the `spin/styles.css`
stylesheet, the `src/lib/components/*.html` transform into custom elements,
the generated component types, theme discovery from `spin/<brand>/`, and the
Studio beside your dev server. The same options work in all seven shapes:
`spin.vite()`, `spin.rspack()`, `spin.webpack()`, `spin.rollup()`,
`spin.rolldown()`, `spin.esbuild()`, and `spin.bun()`.

Shape your brand visually with `npx spin studio`, or scaffold from the
terminal with `npx spin init --language editorial`.

## The CLI

```
spin init        make a project: a brand, and a build config that wires spin
spin studio      open the standalone theme editor
spin brand       read the brands: list, analyze, or rename
spin component   read the components: list, contract, or copy an example
spin mcp         run the agent server over stdio
spin lsp         run the language server over stdio
```

## Subpaths

- `@spinjs/dev/vite` — the unplugin, in all seven bundler shapes.
- `@spinjs/dev/preset` — the UnoCSS preset, `spinPreset`.
- `@spinjs/dev/elements`, `/elements/react`, `/elements/solid`, `/elements/svelte`, `/elements/vue` — generated custom-element declarations: the DOM map, plus one module augmentation per framework.
- `@spinjs/dev/theme` — the theme engine: parsing, validation, design languages, facets.
- `@spinjs/dev/eslint` — the ESLint flat-config plugin.
- `@spinjs/dev/cli` — the `spin` command.
- `@spinjs/dev/api` — the daemon API, including `mountSpinApp`.
- `@spinjs/dev/mcp` — the agent server entry.
- `@spinjs/dev/lsp` — the language server surface.
- `@spinjs/dev/skill` — the house skill assembly.
- `@spinjs/dev/examples` — the component onload examples.
- `@spinjs/dev/compositions` — shared composition shapes.
