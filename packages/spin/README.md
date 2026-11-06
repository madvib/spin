# @spinjs/spin

The Spin toolchain: bundler plugins, the UnoCSS preset, the `.html` component
compiler, the theme engine, the Studio, the CLI, the lint plugins, and the MCP
server. A devDependency — it builds your app but never ships in it.

```sh
npm install -D @spinjs/spin
npm install @spinjs/components @spinjs/runtime
```

```ts
import { spin } from "@spinjs/spin/vite";

export default {
  plugins: [spin.vite()],
};
```

One `spin.vite()` call wires the whole chain: the `uno.css` stylesheet, the
`src/lib/components/*.html` transform into custom elements, the generated
`src/spin-components.d.ts`, theme discovery from `spin/*.json`, and the
Studio beside your dev server (`studio: false` disables it). The same
options work in all seven shapes: `spin.vite()`, `spin.rspack()`,
`spin.webpack()`, `spin.rollup()`, `spin.rolldown()`, `spin.esbuild()`, and
`spin.bun()`.

The two supported entries are `@spinjs/spin/vite` — the unplugin for every
bundler shape — and `@spinjs/spin/preset` — `spinPreset`, the stylesheet-only
path for an existing `uno.config.ts`. Standalone theme editing is
`npx spin studio`.

## The CLI

```
spin init        make a project: a theme, and a build config that wires spin
spin studio      open the standalone theme editor
spin lint        the rules, over a path
spin theme       read the themes: list, analyze, or scaffold one
spin component   read the components: list, contract, or copy an example
spin mcp         run the agent server over stdio
spin check       the rendered checks, over a running app
```

## Subpaths

- `@spinjs/spin/vite` — the unplugin, in all seven bundler shapes.
- `@spinjs/spin/preset` — `spinPreset`, the UnoCSS path.
- `@spinjs/spin/cli` — the `spin` command.
- `@spinjs/spin/mcp` — the agent server entry.
- `@spinjs/spin/api` — the daemon API, including `mountSpinApp`.
- `@spinjs/spin/theme` — the theme engine: parsing, validation, gates, starters.
- `@spinjs/spin/kit` — shared page bits: code blocks, sections, specimens.
- `@spinjs/spin/animation` — theme-driven keyframes and the animation contract.
- `@spinjs/spin/eslint`, `@spinjs/spin/oxlint` — the lint plugins.
- `@spinjs/spin/diagnostics` — the lint rules and their schemas.
- `@spinjs/spin/project` — project reads and writes: themes, components, config.
- `@spinjs/spin/skill` — the house skill assembly.
