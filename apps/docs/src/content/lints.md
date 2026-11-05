<!-- USER COPY SLOT: lints-intro — your own lint philosophy, or the default below. -->

Six rules read your source. They run in three places — oxlint, ESLint, and the
standalone CLI — and all three read the same facts about your project: its
`spin/*.json` themes, its shortcuts, the primitives' owned decisions. A rule
cannot flag what the theme does not know, and two linters cannot disagree.

## The six rules

| Rule                         | Kind              | Fix                                    | What it flags                                                                                                                                             |
| ---------------------------- | ----------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spin/closed-vocabulary`     | error             | removes the dead class                 | A class no theme, shortcut, primitive variant, or `@spinjs/spin/animation` can generate — it emits no CSS                                                        |
| `spin/no-redundant-class`    | error             | removes the redundant class            | A class that sets the exact property and value the element (or active variant) already sets, e.g. `<button class="tracking-wide">` on a button that already wears it |
| `spin/prefer-theme-value`    | error             | none — change the variant or the token | A class that overrides a CSS decision the element owns (`skin`, `typography`, block `spacing` on typed prose)                                             |
| `spin/prefer-element`        | error (single owner) / warn (shared) | none — change the tag | A non-semantic tag carrying a decision the theme gave another element: an error when exactly one element carries it (e.g. `<span class="tracking-tight">` wants `<h1>`), a suggestion when several do |
| `spin/no-unpaired-ink`       | error             | none — pair the ink                    | A foreground `text-*` on a background fill that is not the fill's paired `text-on-<fill>`, e.g. `bg-primary text-primary` wants `bg-primary text-on-primary` |
| `spin/no-handwritten-tokens` | error             | none — use the utility                 | A raw `var(--token)` string in JS/TS/JSX — name the DTCG path through a utility instead                                                                   |

Clearing variants release ownership: a `ghost` button owns no background or ink,
a `bare` alert owns neither, a `card-ghost` owns no surface. Pair custom fills
and inks on those freely — the rules see the cleared ownership and stay quiet.

`bg-surface*` backgrounds allow the default ink and `text-text-muted` — surfaces are
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
  "jsPlugins": ["@spinjs/spin/oxlint"],
  "rules": {
    "spin/no-redundant-class": "error",
    "spin/prefer-theme-value": ["error", { "strictness": "balanced" }]
  }
}
```

```js
// eslint.config.js — spread the recommended set, then tune
import spin from "@spinjs/spin/eslint";

export default [
  ...spin.configs.recommended,
  {
    rules: { "spin/prefer-theme-value": ["error", { strictness: "balanced" }] },
  },
];
```

```bash
npx spin lint src/        # print findings as text (or --format json)
npx spin lint --fix src/  # apply the edits the findings carry
```

The `spin` binary ships with `@spinjs/spin`. The oxlint and ESLint plugins are
the same rules over the same facts, for editors and CI.

> **Note:** The linter reads `class` / `className` JSX attributes — string
> literals, template literals, ternaries, logical expressions — and
> markup-bearing attributes like `html` and `code`. It does not follow imported
> or module-scoped string constants (`const BTN = "..."` stays invisible). Put
> shared class bundles in `spin.vite({ shortcuts: { ... } })` so both UnoCSS and
> the lints validate them.

Project discovery walks up from each linted file: the nearest ancestor
containing `spin/` or `vite.config.ts` is the project root whose themes and
shortcuts the rules read.

## The one escape

Some marks sit outside what a theme can name: a third-party widget you
restyle from the outside, a brand lockup set in the brand face at one
deliberate size. Write `data-spin-escape` on that element and the ownership
rules stand down for its classes — `prefer-element`, `prefer-theme-value`,
`no-redundant-class`, and `no-unpaired-ink` stay quiet there. The vocabulary
rule does not: `closed-vocabulary` still fires inside the escape, because
deliberate code still names nothing dead. The escape covers the element that
carries it, never its children, so reach for it per element — and if you find
yourself reaching for it twice, the theme is missing something worth naming.

## The editor reads the same rules

Write a class your theme cannot make and your editor tells you before you
save: `spin lsp` serves the same six rules over stdio, so the finding under
your cursor and the `spin lint` finding in CI are one finding. Hover a class
to see the CSS your theme puts behind it, with the nearest name it can make
when you misspell one; complete from the vocabulary your theme produces, so
the name you pick is a name that builds. Point any LSP client at `spin lsp`
— no config file, no daemon, just the project beside the file.

<!-- USER COPY SLOT: lints-close — team policy notes (which dial you run, where). -->
