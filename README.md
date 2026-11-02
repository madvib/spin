# spin

One theme, every stack. Spin keeps your interface decisions in a DTCG JSON
theme and makes the whole web surface obey it — React, Solid, Vue, Svelte,
Astro, or plain HTML, across Vite, Rspack, webpack, Rollup, Rolldown, esbuild,
Bun, and UnoCSS.

You write the decisions once — color, type, spacing, radius, motion — as a
theme. Spin turns that theme into the CSS, the styled HTML elements, the
utilities, and the compiled interactive components your interfaces are built
from. Change the theme and everything follows.

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

## The three packages

| Package               | Install as     | What it is                                                                                          |
| --------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| `@spinjs/spin`        | devDependency  | The toolchain: bundler plugins, UnoCSS preset, `.html` component compiler, theme engine, Studio, CLI, lint plugins, MCP server. |
| `@spinjs/components`  | dependency     | The 37 statechart machines and platform controllers, with React, Solid, and DOM adapters.           |
| `@spinjs/runtime`     | dependency     | The signals, template directives, element actions, and finite-state machine interpreter.            |

Public subpaths: `@spinjs/spin/vite` (the plugin in all seven bundler shapes),
`@spinjs/spin/preset` (the stylesheet-only `spinPreset`), `@spinjs/spin/cli`
(the `spin` bin), `@spinjs/spin/mcp`, `@spinjs/spin/api` (including
`mountSpinApp`), plus the toolchain areas (`theme`, `project`, `diagnostics`,
`kit`, `animation`, `skill`). `@spinjs/components` publishes one subpath per
component plus `/react`, `/solid`, `/controller`. `@spinjs/runtime` publishes
`/fsm`, `/actions`, `/props`, `/load`, `/testing`.

## The repository

### Apps

| App              | What it is                                                                   |
| ---------------- | ---------------------------------------------------------------------------- |
| `apps/studio`    | The theme editor: it edits a project's theme and repaints the app beside it. |
| `apps/reference` | The reference app: every element and every utility, exercised.               |
| `apps/docs`      | The documentation site.                                                      |

### Examples

| Example                | What it is                                                      |
| ---------------------- | --------------------------------------------------------------- |
| `examples/coffee`      | A small coffee-shop app, built on the preset and its own theme. |
| `examples/fixture-app` | A bare project carrying `spin/*.json`, used by the daemon.      |

`internal/check` holds the visual-check harness: the browser probes and the
runner every app's configuration feeds. It is internal tooling, and nothing in
it is published.

## Commands

```
bun run dev        # the studio's dev server, alongside the API daemon
bun run dev:docs   # the documentation site
bun test           # the packages' suites (bun:test)
bun run check      # typecheck every package and app, plus the docs lint gate
```

`bun run dev` starts the studio and the daemon it talks to. The studio is the
editor: it reads a project's theme, repaints the app beside it as you type, and
writes the document back to disk when you save.

## The npm packages

Every package that ships carries a single `packages/<name>/package.json`. Its
top-level `exports` points at `./src/...` so workspace development (`bun test`,
`tsc`, Vite) resolves TypeScript source directly; its `publishConfig.exports`
points at `./dist/...` so packing and publishing swap in the built files. The
build writes the distribution — compiled JavaScript and declarations, one
`packages/<name>/dist/` per package — and the check compares it against the
source manifest:

```
bun run build:dist   # the dist for every publishable package
bun run check:dist   # the export maps agree, every subpath resolves
bun run pack         # pack every tarball the release ships
```

## Where to read more

- [`packages/spin/README.md`](packages/spin/README.md) — the toolchain.
- [`packages/components/README.md`](packages/components/README.md) — the component library.
- [`packages/runtime/README.md`](packages/runtime/README.md) — the reactive runtime.
- [`apps/docs`](apps/docs) — the documentation site; `bun run dev:docs` runs
  it, and its install page carries the per-bundler recipes.

## Status

0.1.x. MIT licensed; see [LICENSE](LICENSE).
