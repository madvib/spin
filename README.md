# spin

One brand, every stack. Shape your brand's colors, type, spacing, and modes
once in the Studio, and Spin turns it into the CSS, the styled HTML elements,
the utilities, and the interactive components your interfaces are built from —
across Solid, React, Vue, Svelte, or plain HTML, and Vite, Rspack, webpack,
Rollup, Rolldown, esbuild, Bun, and UnoCSS.

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

Run `npx spin init`, pick one of six design languages as your starting point,
and tune until the preview reads like your product. What you save becomes the
`spin/<brand>/` directory your build serves — never locked to a canned theme.

## The two packages

| Package              | Install as    | What it is                                                                                        |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| `@spinjs/dev`        | devDependency | The toolchain: bundler plugins, theme engine, Studio, CLI, LSP, lints, and MCP server.            |
| `@spinjs/components` | `dependency` | Accessible interactive components and client runtime, with React and Solid hooks plus controller bindings for Vue, Svelte, and HTML. |

Public subpaths: `@spinjs/dev/vite` (the plugin in all seven bundler shapes),
`@spinjs/dev/preset` (the stylesheet-only preset), `@spinjs/dev/theme` (the
token parser, design languages, and facets), `@spinjs/dev/diagnostics` and
`@spinjs/dev/eslint` (the lint rules), `@spinjs/dev/cli` (the `spin` bin),
`@spinjs/dev/mcp`, `@spinjs/dev/lsp`, `@spinjs/dev/api` (including
`mountSpinApp`), plus `/skill`, `/compositions`, and `/examples`.
`@spinjs/components` publishes one subpath per component plus `/react`,
`/solid`, `/controller`, and `/runtime`.

## The repository

### Apps

| App              | What it is                                                                   |
| ---------------- | ---------------------------------------------------------------------------- |
| `apps/studio`    | The brand editor: it shapes a project's brand and repaints the app beside it. |
| `apps/reference` | The reference app: every element and every utility, exercised.               |
| `apps/docs`      | The documentation site, including the 5-runtime Playground.                  |

### Examples

| Example                | What it is                                                      |
| ---------------------- | --------------------------------------------------------------- |
| `examples/coffee`      | A small coffee-shop app, built on the preset and its own brand. |
| `examples/fixture-app` | A bare project carrying `spin/<brand>/`, used by the daemon.    |

`internal/kit` holds the shared docs/reference UI kit (theme state, pickers,
specimens). `internal/check` holds the visual-check harness: the browser
probes and the runner every app's configuration feeds. Both are internal
tooling; nothing in them is published.

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

- [`packages/dev/README.md`](packages/dev/README.md) — the toolchain.
- [`packages/components/README.md`](packages/components/README.md) — the component library.
- [`apps/docs`](apps/docs) — the documentation site; `bun run dev:docs` runs
  it, and Bundler Setup carries the per-bundler recipes.

## Status

0.2.0-preview.1. MIT licensed; see [LICENSE](LICENSE).
