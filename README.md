# spin

A theme system for agent-authored UI. You bring a DTCG JSON theme; spin turns it
into the utilities that spend it, a library of styled elements, a studio to edit
it live, and the tooling that checks the result — an oxlint plugin, an MCP
server, and a visual check that renders every theme in a browser.

One theme document per theme, in `spin/*.json` at a project's root. The build
reads it and emits CSS custom properties; every utility and every element
resolves against those properties, so replacing the document replaces the
product's look without touching its markup.

## The repository

### Packages

| Package             | What it is                                                                  |
| ------------------- | --------------------------------------------------------------------------- |
| `@spin/theme`       | The token pipeline: parse, validate, mutate, scaffold, emit.                |
| `@spin/preset`      | The UnoCSS preset: the utilities, the element library, the plugin.          |
| `@spin/project`     | The project: where it is, what it holds, and the operations over its files. |
| `@spin/animation`   | Keyframes, and the `animate-*` utilities that name them.                    |
| `@spin/diagnostics` | The diagnostics: the lints, the rendered checks, and the service over them. |
| `@spin/api`         | The daemon: the procedures, over RPC, that the tools share.                 |
| `@spin/mcp`         | The MCP server over those procedures, for agents.                           |
| `@spin/kit`         | Shared Solid pieces: the theme state and the theme picker.                  |
| `@spin/runtime`     | The component runtime: signals, bridges, syntax, and directives.            |
| `@spin/components`  | The machine components: headless statecharts with typed bridges.            |
| `@spin/hooks`       | Framework bindings for spin components: Solid and React.                    |

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
bun run dev      # the studio's dev server, alongside the API daemon
bun test         # the packages' suites (bun:test)
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
```

The manifests are not published yet; publishing is a decision, not a default.

## Where to read more

- [`packages/theme/README.md`](packages/theme/README.md) — the token pipeline's
  contract.
- [`packages/preset/README.md`](packages/preset/README.md) — the utilities, the
  element library, and the plugin's options.
- [`apps/docs`](apps/docs) — the documentation site; `bun run dev:docs` runs
  it, and its install page carries the per-bundler recipes.

## Status

Pre-alpha. The packages are consumed from source — workspace imports today — and
the npm distributions are built but unpublished. MIT licensed; see
[LICENSE](LICENSE).
