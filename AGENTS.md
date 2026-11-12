# AGENTS.md — spin

spin is a **verification layer + primitives for agent-authored UI**. It gives
agents a closed vocabulary (design tokens), a way to express styles, components
to build from, and oracles that mechanically verify the result.

## Core principles

1. **The theme is the only way to style.** No inline styles, no ad-hoc CSS
   files, no one-off hex values. If a visual decision exists, it exists as a
   theme token.
2. **UnoCSS is the only way to apply styles.** Utility classes only. No
   `<style>` blocks, no CSS modules, no runtime style injection.
3. **Primitives are the only way to build components.** No ad-hoc markup
   assemblies that duplicate a primitive's behavior.
4. **Design tokens are the only values.** Colors, spacing, radii, shadows,
   typography come from the token set. If you cannot name the token, you do not
   have the design decision.

## Conventions

- **Bun workspace.** Library packages stay zero-install (the `@spinjs/*`
  workspace names). Apps run under Bun too and may use `node_modules` via
  Bun's npm support.
- **TypeScript only.** Strict mode, built-in types, no ambient declaration
  files.
- **Tests first (TDD).** Write the failing test, then the implementation. A
  behavior without a test does not exist; a test without a behavior does not
  either.
- **No runtime APIs.** The only runtime surface spin exposes is the CSS custom
  properties that carry theme tokens. No JS plugins, no registration calls, no
  globals.
- **Closed vocabulary.** Anything not in the token set / token list does not
  ship. Additions are explicit, reviewed changes to the theme — never an escape
  hatch at the call site.
- **No agent-authored `*.md` in the repo.** No `docs/`, `specs/`, `DESIGN.md`,
  or hand-written prose files. Operational docs that would go stale go in
  `.agents/specs/` (git-ignored). Code, tests, and `README.md` per package are
  the only authored files. The two exceptions are `packages/theme/skill/` (the
  house skill is the theme module's manual and a product that ships alongside
  the language it describes) and `apps/docs/src/content/` (the public
  documentation site's markdown copy modules).

### Comment etiquette

Comments carry **invariants the code cannot state**: why an ordering matters,
what a workaround compensates for, the contract a caller must hold. Nothing
else. Specifically **not in the repo**:

- **Strategy and rationale** — why the architecture is shaped this way, what was
  considered and rejected, how the pieces relate as a system. That lives in the
  untracked design doc (`.local/PRINCIPLES.md`; `.agents/specs/` for scratch
  work), never as a file-header essay.
- **Changelogs and history** — "fixed the X bug", "previously this did Y", issue
  numbers, dates. Git records what changed; a comment explaining that a line
  used to be different is stale the moment it is written.
- **Narration of the obvious** — restating what the next line does, section
  banners over three lines of code, tutorial asides.
- **Cross-file signposting** — "see other-file.ts for how this is used". Links
  rot; the type system and tests carry the contract.

Terse, attached to the code it constrains, and load-bearing. If deleting a
comment would not mislead a reader, delete it.

## Comments

Terse and professional. A comment describes the thing it annotates: a
precondition, a consequence, a reason the code cannot state itself.

It does not narrate a decision, ask a question, record a change, or refer to
another module, a file, an application, or a conversation. It does not restate
the path of the file it sits in.

A file header says what the file is, in one line, and stops.

Reasoning that does not become a rule does not get written down. If a decision
needs a paragraph of justification it belongs in a commit message, which is
where history lives.

## Packages

| Package              | Role                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `@spinjs/components` | The machine components and reactive runtime (`/runtime`, `/react`, `/solid`, `/controller`, plus per-component subpaths). |
| `@spinjs/dev`        | The published toolchain: themes, the preset and `spin` plugin, Studio, the daemon, lints, LSP, CLI, and MCP server. |

Public subpaths: `@spinjs/dev/vite`, `/preset`, `/theme`, `/diagnostics`, `/eslint`, `/cli`, `/mcp`, `/lsp`, `/api`, `/skill`, `/compositions`, `/examples`. Internal workspace layers (`@spinjs/{theme,preset,diagnostics,server,build}`) stay `private: true` and bundle into `@spinjs/dev`.

### The element library

The primitives are a layer, not a package: they live in `packages/preset/src/rules/primitives/` — one file per element, beside the examples that show it. There are no component stylesheets; an element ships by being matched.

Each element's contract with the theme is written down in `packages/preset/src/rules/primitives/manifest.ts`, and `bun run codegen` derives that manifest by probing the rules themselves, so the manifest cannot disagree with the code that produces it. The lint plugin and the docs site read that manifest; nothing maintains a second list.

Supporting trees:

- `apps/reference/` — the reference application: every primitive and gate,
  exercised.
- `apps/reference/visual/` — the reference's config for the visual check:
  routes, themes, geometry claims, page conventions — and the baseline it is
  measured against.
- `internal/check/` — the visual check harness: the browser probes and the
  runner every app's config feeds. Internal tooling; nothing here is published.
- `apps/studio/e2e/` — the studio's end-to-end tests: the editor driven in a
  browser, read back through its own RPC.

### Package rules

- A module outside `@spinjs/theme` MUST NOT hardcode a token value. Read it
  from the theme.
- Only `@spinjs/preset` references UnoCSS internals.
- Only `@spinjs/server` reads or writes a project's files on disk.
- `@spinjs/diagnostics` MUST NOT re-implement theme resolution; it asks `@spinjs/theme`.
  Dependencies point downward: `dev` → `{build,server,diagnostics,preset,theme}`
  and `components`; `@spinjs/components/runtime` depends on no workspace package.
- Every package owns its `package.json`, exports from `src/` subpaths during
  development (`publishConfig.exports` swaps in `dist/` for published packages),
  and defines `test` / `lint` / `fmt` scripts.

## Testing culture

These are rules, not preferences. A test that violates them is worse than a
missing test, because it silently rewrites the contract.

- **NO negative assertions.** Never assert that something _doesn't_ happen or
  isn't present ("no unknown class", "no inline style"). Negative assertions
  pass when the check is broken, and they encode nothing a consumer can observe.
  Assert the positive output you produced.
- **NO pins.** Never assert an exact full output that exists only to detect
  incidental churn (byte-for-token snapshots of every value, exhaustive lists of
  incidental defaults). If a value is contractual, test it directly; if not,
  don't freeze it.
- **NO tombstone tests.** A test that only proves something exists, doesn't
  throw, is non-empty, or got longer proves nothing. Every test must be capable
  of failing.
- **NO tests that leak implementation details.** Test the observable contract:
  the value a consumer reads, the CSS variable that lands in the output, the
  error a caller sees. Never assert on internal call order, private structure,
  chosen algorithm, or source text.
- **NO testing other people's code.** Don't write tests asserting on a
  dependency's behavior, on Bun internals, or on a browser feature that we
  merely consume. Test our contract.
- **NO mocking our own code.** Mocking our own implementation in a test proves
  the test's mock, not our code. If a test needs a mock of something we own, the
  design is wrong — fix the design (inject at a real boundary) or test the real
  thing.

### What a test earns its place for

Behavior, boundaries, invariants, transitions, precedence, and real errors.
Deterministic, isolated, and safe for the full suite to run. A test that no
plausible bug could fail is a tombstone test — delete it.
