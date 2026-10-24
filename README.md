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

Three packages ship under `@spinjs`. Everything else is an app, an example,
internal tooling, or source inside one of the three.

| Package               | What it is                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `@spinjs/runtime`     | The component runtime: signals, bridges, elements, directives, machines. Browser dependency. |
| `@spinjs/components`  | The machine components: per-component subpaths plus `/react`, `/solid`, `/controller`.       |
| `@spinjs/spin`        | The toolchain: themes, the preset and `spin()` plugin, the daemon, lints, MCP server.        |

Public subpaths: `@spinjs/spin/vite` (the plugin), `@spinjs/spin/eslint`,
`@spinjs/spin/cli` (the `spin` bin), `@spinjs/spin/mcp`, plus the toolchain
areas (`theme`, `preset`, `project`, `diagnostics`, `api`, `animation`).

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

- [`packages/spin/README.md`](packages/spin/README.md) — the toolchain's
  contract.
- [`apps/docs`](apps/docs) — the documentation site; `bun run dev:docs` runs
  it, and its install page carries the per-bundler recipes.

## Status

Pre-alpha. The packages are consumed from source — workspace imports today — and
the npm distributions are built but unpublished. MIT licensed; see
[LICENSE](LICENSE).
