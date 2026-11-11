# @spinjs/spin

The Spin toolchain: the bundler plugin, the CLI, the daemon API, the Studio
server, the lint front ends, the LSP, and the MCP server. A devDependency —
it builds your app but never ships in it.

```sh
npm install -D @spinjs/spin
npm install @spinjs/components
```

```ts
import { spin } from "@spinjs/spin/vite";

export default {
  plugins: [spin.vite()],
};
```

One `spin.vite()` call wires the whole chain: the `uno.css` stylesheet, the
`src/lib/components/*.html` transform into custom elements, the generated
`src/spin-components.d.ts`, theme discovery from `spin/`, and the
Studio beside your dev server. The same options work in all seven shapes:
`spin.vite()`, `spin.rspack()`, `spin.webpack()`, `spin.rollup()`,
`spin.rolldown()`, `spin.esbuild()`, and `spin.bun()`.

The two supported entries are `@spinjs/spin/vite` — the unplugin for every
bundler shape — and `@spinjs/preset` — `spinPreset`, the stylesheet-only
path for an existing `uno.config.ts`. Standalone theme editing is
`npx spin studio`.

## The CLI

```
spin init        make a project: a brand, and a build config that wires spin
spin studio      open the standalone theme editor
spin lint        the rules, over a path
spin theme       read the themes: list or analyze
spin component   read the components: list, contract, or copy an example
spin mcp         run the agent server over stdio
spin lsp         run the language server over stdio
spin check       the rendered checks, over a running app
```

## Subpaths

- `@spinjs/spin/vite` — the unplugin, in all seven bundler shapes.
- `@spinjs/spin/plugin` — the plugin barrel: `spin` plus the build stages.
- `@spinjs/spin/cli` — the `spin` command.
- `@spinjs/spin/api` — the daemon API, including `mountSpinApp`.
- `@spinjs/spin/mcp` — the agent server entry.
- `@spinjs/spin/lsp` — the language server surface.
- `@spinjs/spin/skill` — the house skill assembly.
- `@spinjs/spin/examples` — the component onload examples.
- `@spinjs/spin/compositions` — shared composition shapes.

The toolchain's siblings carry the rest: `@spinjs/theme` (parsing,
validation, gates, design languages), `@spinjs/preset` (the UnoCSS preset,
primitives), `@spinjs/server` (project reads/writes, procedures, daemon),
`@spinjs/diagnostics` (the lint rules, service, and editor plugins), and
`@spinjs/build` (the components stage, strict gate, content scan,
cross-theme report).
