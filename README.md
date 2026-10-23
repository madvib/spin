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
| `@spin/animation`   | Keyframes, and the `animate-*` utilities that name them.                    |
| `@spin/diagnostics` | The diagnostics: the lints, the rendered checks, and the service over them. |
| `@spin/api`         | The daemon: the procedures, over RPC, that the tools share.                 |
| `@spin/mcp`         | The MCP server over those procedures, for agents.                           |
| `@spin/kit`         | Shared Solid pieces: the theme state and the theme picker.                  |

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
deno task dev     # the studio's dev server, alongside the API daemon
deno task test    # the packages' suites
```

`deno task dev` starts the studio and the daemon it talks to. The studio is the
editor: it reads a project's theme, repaints the app beside it as you type, and
writes the document back to disk when you save.

## The npm packages

Every package that ships has an npm manifest, and the manifest says what the
package's `deno.json` says: the same subpaths, the same version, the same files.
The build writes the distribution — compiled JavaScript and declarations, one
directory per package — and the check compares it against the source package:

```
deno task build:dist   # the dist for every publishable package
deno task check:dist   # the export maps agree, every subpath resolves
```

Each package's npm manifest lives in `packages/<name>/npm`, beside the `dist/`
it names — so `npm publish packages/<name>/npm` packs the build and nothing
else. It is not at the package's root on purpose: a `package.json` there would
make Deno resolve every bare `@spin/…` import in this workspace through it, and
the apps here are written against the source.

The manifests are not published yet; publishing is a decision, not a default.

## Where to read more

- [`packages/theme/README.md`](packages/theme/README.md) — the token pipeline's
  contract.
- [`packages/preset/README.md`](packages/preset/README.md) — the utilities, the
  element library, and the plugin's options.
- [`apps/docs`](apps/docs) — the documentation site; `deno task dev:docs` runs
  it, and its install page carries the per-bundler recipes.

## Status

Pre-alpha. The packages are consumed from source — workspace imports today — and
the npm distributions are built but unpublished. MIT licensed; see
[LICENSE](LICENSE).
