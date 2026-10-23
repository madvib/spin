<!-- USER COPY SLOT: lints-intro — your own lint philosophy, or the default below. -->

# Lints & Dials

Six rules read your source. They run in three places — oxlint, ESLint, and the
standalone CLI — and all three read the same facts about your project: its
`spin/*.json` themes, its shortcuts, the primitives' owned decisions. A rule
cannot flag what the theme does not know, and two linters cannot disagree.

## The six rules

| Rule                         | Kind              | Fix                                    | What it flags                                                                                                                                             |
| ---------------------------- | ----------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spin/closed-vocabulary`     | error             | removes the dead class                 | A class no theme, shortcut, primitive variant, or `@spin/animation` can generate — it emits no CSS                                                        |
| `spin/no-redundant-class`    | error             | removes the redundant class            | A class that sets the exact property and value the element (or active variant) already sets, e.g. `<h3 class="text-xl">`                                  |
| `spin/prefer-theme-value`    | error             | none — change the variant or the token | A class that overrides a CSS decision the element owns (`skin`, `typography`, block `spacing` on typed prose)                                             |
| `spin/prefer-element`        | warn / suggestion | none — change the tag                  | A non-semantic tag carrying a decision that belongs to a semantic element, e.g. `<span class="text-3xl">` wants `<h1>`                                    |
| `spin/no-unpaired-ink`       | error             | none — pair the ink                    | A foreground `text-*` on a background fill that is not the fill's paired `text-on-<fill>`, e.g. `bg-primary text-text` wants `bg-primary text-on-primary` |
| `spin/no-handwritten-tokens` | error             | none — use the utility                 | A raw `var(--token)` string in JS/TS/JSX — name the DTCG path through a utility instead                                                                   |

Clearing variants release ownership: a `ghost` button owns no background or ink,
a `bare` alert owns neither, a `card-ghost` owns no surface. Pair custom fills
and inks on those freely — the rules see the cleared ownership and stay quiet.

`bg-surface*` backgrounds allow `text-text` and `text-text-muted` — surfaces are
the default ground, not a fill with a paired ink. Every other fill demands its
`text-on-<fill>`, in every state prefix you write (`hover:bg-accent` demands
`hover:text-on-accent`).

## The dials

`strictness` decides which tiers count as painting over the element: `"strict"`
(the default) holds skin, typography, and block spacing; `"balanced"` holds skin
only and lets typography and spacing classes through on any element; `"lenient"`
disables the element-override checks while keeping `closed-vocabulary`,
`no-unpaired-ink`, and `no-handwritten-tokens` on every tag.

`semanticTags` decides which elements the semantic rules apply to: `"native"`
(the default — only native HTML tags), `"spin"` (only Spin custom elements like
`<card>` and `<badge>`), `"all"` (both), `"none"` (neither — `prefer-element`
goes quiet).

### Setup recipes

```json
// .oxlintrc.json — jsPlugins carry the theme-aware rules
{
  "jsPlugins": ["@spin/diagnostics"],
  "rules": {
    "spin/no-redundant-class": "error",
    "spin/prefer-theme-value": ["error", { "strictness": "balanced" }]
  }
}
```

```js
// eslint.config.js — spread the recommended set, then tune
import spin from "@spin/diagnostics/eslint";

export default [
  ...spin.configs.recommended,
  {
    rules: { "spin/prefer-theme-value": ["error", { strictness: "balanced" }] },
  },
];
```

```bash
deno run --allow-read --allow-write --allow-env src/cli.ts lint src/        # print findings as text (or --format json)
deno run --allow-read --allow-write --allow-env src/cli.ts lint --fix src/  # apply the edits the findings carry
```

v0.1 ships no `spin` binary — the CLI runs from source in the diagnostics
package (`deno task lint:cli`). The oxlint and ESLint plugins are the same rules
over the same facts, for editors and CI.

> **Note:** The linter reads `class` / `className` JSX attributes — string
> literals, template literals, ternaries, logical expressions — and
> markup-bearing attributes like `html` and `code`. It does not follow imported
> or module-scoped string constants (`const BTN = "..."` stays invisible). Put
> shared class bundles in `spin.vite({ shortcuts: { ... } })` so both UnoCSS and
> the lints validate them.

Project discovery walks up from each linted file: the nearest ancestor
containing `spin/` or `vite.config.ts` is the project root whose themes and
shortcuts the rules read.

<!-- USER COPY SLOT: lints-close — team policy notes (which dial you run, where). -->
