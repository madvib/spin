<!-- Spin lints: one rule engine behind every tool you already run. -->

Spin has **one rule engine** that plugs into the tools you already run — you
do not adopt a new toolchain:

- **Bundler (`spin.vite()`)**: blocks unknown and dead class names at build
  time, before broken markup ships.
- **Linter (`npx spin init --linter oxlint` or `eslint`, or `npx spin lint`
  in CI)**: checks all six rules, including redundant classes, element
  paint collisions, and unpaired text contrast.
- **Editor (`spin lsp`)**: shows hover CSS previews, class autocomplete,
  and one-keystroke quick fixes as you type.

Every surface reads the same facts about your project — its
`spin/<brand>/` themes, its shortcuts, the primitives' owned decisions —
so a finding in your editor and the same finding in CI are one finding.

## Setup recipes

Scaffold the linter when you create a project:

```bash
npx spin init --linter oxlint
```

Or wire an existing project. For oxlint, add the theme-aware plugin in
`.oxlintrc.json`:

```json
{
  "jsPlugins": ["@spinjs/dev/diagnostics"],
  "rules": {
    "spin/no-redundant-class": "error",
    "spin/prefer-theme-value": ["error", { "strictness": "balanced" }]
  }
}
```

For ESLint, spread the recommended set in `eslint.config.js`:

```js
import spin from "@spinjs/dev/eslint";

export default [
  ...spin.configs.recommended,
  {
    rules: { "spin/prefer-theme-value": ["error", { strictness: "balanced" }] },
  },
];
```

And run the same rules standalone in CI, applying fixes where the finding
carries an edit:

```bash
npx spin lint src/        # print findings as text (or --format json)
npx spin lint --fix src/  # apply the edits the findings carry
```

The `spin` binary ships with `@spinjs/dev`. The oxlint plugin
(`jsPlugins: ["@spinjs/dev/diagnostics"]`) and the ESLint plugin
(`@spinjs/dev/eslint`) are the same rules over the same facts, for editors
and CI. The bundler plugin fails production builds on the same vocabulary
the lints enforce: a class no theme can produce refuses `vite build` with
the file, the class, and what to write instead.

> **Note:** The linter reads `class` / `className` / `classList` / `:class`
> attributes and sibling `variant="..."` values across `.ts`, `.tsx`, `.js`,
> `.jsx`, `.html`, `.vue`, `.svelte`, and `.astro` — string literals, template
> literals, ternaries, conditional objects, and each conditional branch. It does
> not follow imported or module-scoped string constants (`const BTN = "..."`
> stays invisible). Put shared class bundles in `spin.vite({ shortcuts: { ... } })`
> so both UnoCSS and the lints validate them.

Project discovery walks up from each linted file: the nearest ancestor
containing `spin/` or `vite.config.ts` is the project root whose themes and
shortcuts the rules read.

## The six rules

| Rule | What it flags |
| ---- | ------------- |
| `spin/closed-vocabulary` | A class no theme, shortcut, primitive variant, or `@spinjs/dev/preset` can generate — it emits no CSS. Dynamic prefix interpolation (`bg-` + tone) is the same fault: a name static extraction cannot see. The fix removes the dead class. |
| `spin/no-redundant-class` | A class that sets the exact property and value the element (or active variant) already sets, e.g. `type-body` on a `<p>` that already reads it. The fix removes the redundant class. |
| `spin/prefer-theme-value` | A class that overrides a CSS decision the element owns (`skin`, `typography`, block `spacing` on typed prose), or two `type-*` styles on one element in one state — one paint slot, one style. Change the variant or the token; there is no class-level fix. |
| `spin/prefer-element` | A non-semantic tag carrying a decision the theme gave exactly one element (e.g. `<span class="text-link">` wants `<a>`). Advisory everywhere: the wrong element is placement advice, not a contradiction. Shared inks (`text-primary`, `text-muted`) and `type-*` styles are placement-open and never flag. Change the tag; there is no class-level fix. |
| `spin/no-unpaired-ink` | A background fill wearing a different ink than the palette pairs with it, e.g. `bg-primary text-primary` wants `bg-primary text-on-primary`. Pair the ink; there is no class to drop. |
| `spin/no-handwritten-tokens` | A hand-set value for a theme-owned property — an inline `style` color, a `<style>` block, or any raw token the utility vocabulary should spend instead. Spend the token through a utility. |

Clearing variants release ownership: a `ghost` button owns no background or
ink, a `bare` alert owns neither, a `card-ghost` owns no surface. Pair custom
fills and inks on those freely — the rules see the cleared ownership and
stay quiet. Runtime geometry (`left`, `top`, `width`, `height`, `transform`,
`flexBasis`) stays legal inline: a machine positioning its own parts is not
styling them.

`bg-surface*` backgrounds allow the default ink and `text-muted` — surfaces
are the default ground, not a fill with a paired ink. A fill with no ink at
all inherits, which may be exactly right; only a stated ink against a declared
pairing contradicts.

## The dials

`strictness` decides which tiers count as painting over the element:
`"strict"` (the default) holds skin, typography, and block spacing;
`"balanced"` holds skin and typography while relaxing block-margin ownership
on `<p>`/headings outside typed prose; `"lenient"` disables the
element-override checks while keeping `closed-vocabulary`,
`no-unpaired-ink`, and `no-handwritten-tokens` on every tag.

`semanticTags` decides which elements the semantic rules apply to:
`"native"` (the default — only native HTML tags), `"spin"` (only Spin custom
elements like `<card>` and `<badge>`), `"all"` (both), `"none"` (neither —
`prefer-element` goes quiet).

## The editor reads the same rules

Write a class your theme cannot make and your editor tells you before you
save: `spin lsp` serves the same six rules over stdio, so the finding under
your cursor and the `spin lint` finding in CI are one finding. Hover a class
to see the CSS your theme puts behind it, with the nearest name it can make
when you misspell one; complete from the vocabulary your theme produces, so
the name you pick is a name that builds; accept the quick fix and the
finding's own edit lands — redundant and dead classes drop with one
keystroke. Point any LSP client at `spin lsp` — no config file, just the
project beside the file.
