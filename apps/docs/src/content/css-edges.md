<!-- USER COPY SLOT: css-intro — your own mental model of the cascade, or the default below. -->

## The closed vocabulary & editor tooling

Every utility class in Spin maps to a declared token in your `spin/*.json` theme (`p-4` → `var(--spacing-4)`, `bg-surface-raised` → `var(--color-surface-raised)`, `rounded-md` → `var(--radius-md)`). If a token step does not exist in your theme — or if you write an arbitrary bracket class (`w-[320px]`, `bg-[#ff0000]`) or a misspelled role (`bg-success` instead of `bg-semantic-success`) — the preset emits **no CSS rule**.

Because UnoCSS silently ignores unmatched classes at build time, Spin provides three layers of editor and CLI tooling so unknown classes are caught immediately as you type:

1. **Inline editor squiggles (`@spinjs/spin/eslint` & `@spinjs/spin/oxlint`):** The `spin/closed-vocabulary` rule reads your project's `spin/*.json` files directly, computes the exact utility set your theme generates, and underlines any unknown or undeclared class in red inside VS Code, Cursor, Zed, or Neovim with a one-click autofix.
2. **Theme-aware autocomplete (UnoCSS editor extension):** `spinPreset` registers `autocomplete.templates` (`bg-$colors`, `border-$colors`, `p-$spacing`, `m-$spacing`, `gap-$spacing`, `rounded-$radius`, `shadow-$shadow`, `text-$fontSize`, `font-$fontFamily`, plus every shortcut and primitive variant) populated dynamically from your theme's token steps.
3. **CLI & agent checks (`npx spin lint` & MCP `utility` / `lint` tools):** `npx spin lint` verifies JSX/TSX and `.html` files in CI or pre-commit, and the `spin` MCP server (`npx spin mcp`, wired into `.mcp.json` by `spin init`) lets coding agents query valid utilities before writing markup.

```ts
// eslint.config.js — inline editor diagnostics for unknown classes & unpaired inks
import spin from "@spinjs/spin/eslint";

export default [
  spin.configs.recommended,
];
```

## Paired fills, semantic inks, and dark mode

Every fill token in your theme has a paired foreground ink role tested against WCAG contrast floors in every declared mode:

- **Brand & accent fills:** `bg-primary text-on-primary`, `bg-secondary text-on-secondary`, `bg-accent text-on-accent`
- **Semantic status fills:** `bg-semantic-success text-on-semantic-success`, `bg-semantic-warning text-on-semantic-warning`, `bg-semantic-error text-on-semantic-error`, `bg-semantic-info text-on-semantic-info`
- **Surfaces:** `bg-surface text-text`, `bg-surface-raised text-text`, `bg-surface-sunken text-text` (with `text-text-muted` for secondary copy)

Spin switches light and dark palettes via `[data-mode="dark"]` on `<html>` or any container subtree. There is no `dark:` utility prefix — `bg-surface` and `text-text` resolve to the active mode's tokens automatically, and `spin/no-unpaired-ink` flags any fill missing its paired ink.

## State variants and responsive breakpoints

- **Interactive states:** `hover:`, `focus:`, `focus-visible:`, `active:`, `disabled:`, `aria-[current]:`, `data-[state=open]:`, `group-hover:`, `peer-hover:`
- **Responsive breakpoints:** `sm:`, `md:`, `lg:`, `xl:` — generated directly from your theme's `breakpoint.*` tokens (`@media (min-width: ...)`).

## Custom project shortcuts

In addition to the shipped `spinShortcuts` listed below, you can register project-specific utility compositions in `spin.vite({ shortcuts: { ... } })`. Both the stylesheet compiler and `spin/closed-vocabulary` read `shortcuts` from your bundler config, and `spin lint` verifies that every utility inside your custom shortcut exists in your theme:

```ts
spin.vite({
  shortcuts: {
    "page-shell": "mx-auto w-full max-w-screen-lg px-6 py-10 stack-lg",
  },
});
```

<!-- USER COPY SLOT: css-close — your own edge notes or migration gotchas. -->
