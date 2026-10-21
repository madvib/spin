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

- **Deno workspace.** Library packages stay zero-install (URL imports or the
  `@spin/*` workspace names; `npm:` specifiers where an npm dep is needed). Apps
  run under Deno too and may use `node_modules` via Deno's npm support.
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
  the only authored files.

## Packages

| Package           | Role                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `@spin/theme`     | Token pipeline: parse, validate, mutate, scaffold, emit CSS variables. Knows nothing of components.    |
| `@spin/animation` | Keyframes and the `animate-*` utilities that name them — the one global CSS namespace, given one home. |
| `@spin/preset`    | UnoCSS preset: the utility vocabulary a theme spends, and the element library as rules.                |
| `@spin/lint`      | oxlint plugin: programmatic checks that authored UI stays inside the system.                           |
| `@spin/api`       | The daemon: the procedures, over RPC, that the studio and the MCP server share.                        |
| `@spin/mcp`       | The MCP server over those procedures, for agents.                                                      |
| `@spin/kit`       | Shared Solid pieces: the theme state and the theme picker.                                             |

### The element library

The primitives are a layer, not a package: they live in the preset, as RULES
under `packages/preset/src/rules/primitives/` — one file per element, beside the
examples that show it. There are no component stylesheets; an element ships by
being matched.

What the old `.css` + manifest package did is still here, in the shape the rules
can carry it: each element's contract with the theme is written down in
`packages/preset/src/rules/primitives/manifest.ts`, and `deno task codegen` in
the preset derives that manifest by probing the rules themselves, so the
manifest cannot disagree with the code that produces it. The lint plugin and the
docs site read that manifest; nothing maintains a second list.

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

- A package that is not `@spin/theme` MUST NOT hardcode a token value. Read it
  from the theme.
- A package that is not `@spin/preset` MUST NOT reference UnoCSS internals.
- `@spin/lint` MUST NOT re-implement theme resolution; it asks the theme.
  Dependencies point downward: lint → preset → theme; lint → animation → theme;
  api → preset → theme; mcp → api.
- Every package owns its `deno.json`, exports only from `src/index.ts`, and has
  its own `test` / `lint` / `fmt` tasks.

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
  dependency's behavior, on Deno internals, or on a browser feature that we
  merely consume. Test our contract.
- **NO mocking our own code.** Mocking our own implementation in a test proves
  the test's mock, not our code. If a test needs a mock of something we own, the
  design is wrong — fix the design (inject at a real boundary) or test the real
  thing.

### What a test earns its place for

Behavior, boundaries, invariants, transitions, precedence, and real errors.
Deterministic, isolated, and safe for the full suite to run. A test that no
plausible bug could fail is a tombstone test — delete it.
