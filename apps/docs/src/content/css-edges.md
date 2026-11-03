<!-- USER COPY SLOT: css-intro — your own mental model of the cascade, or the default below. -->

## The closed vocabulary & how Spin's linter enforces it

Every utility class in Spin maps to a declared token in your `spin/*.json` theme (`p-4` → `var(--spacing-4)`, `bg-surface-raised` → `var(--color-surface-raised)`, `rounded-md` → `var(--radius-md)`). If a token step is not declared in your theme — or if you write an arbitrary bracket value (`w-[320px]`, `bg-[#ff0000]`) or a misspelled role (`bg-success` instead of `bg-semantic-success`) — the preset emits **no CSS rule**.

Because UnoCSS silently drops unmatched classes at build time, Spin ships a **linter-neutral diagnostics core** (`@spinjs/spin/eslint`, `@spinjs/spin/oxlint`, and `npx spin lint`) that reads your project's `spin/*.json` themes directly from disk — with **no `uno.config.ts` required** — and flags issues in your editor and CI:

- **`spin/closed-vocabulary` (error):** Flags any class your project's theme cannot generate (`p-13`, `bg-success`, `w-[320px]`), including unknown classes inside custom `shortcuts`, with a quick-fix.
- **`spin/no-unpaired-ink` (error):** Flags a background fill whose foreground ink does not match the theme's paired role (`bg-primary` without `text-on-primary`).
- **`spin/no-redundant-class` (error):** Flags a utility that sets a CSS property to the exact value the enclosing element already owns (`py-2` on `<td>`, `font-semibold` on `<h3>`).
- **`spin/prefer-theme-value` (error):** Flags a utility that overrides a design decision the enclosing element owns (`font-mono` or `text-xs` on `<h3>`, `px-3` on `<td>`).
- **`spin/prefer-element` (warning):** Flags a `<div>` or `<span>` wearing typography classes that belong to a semantic element (`<card-title>`, `<h2>`, `<p>`).
- **`spin/no-handwritten-tokens` (error):** Flags raw `var(--*)` CSS custom properties written in markup instead of token utilities.

```ts
// eslint.config.js — runs in VS Code / Cursor / Neovim via the ESLint extension, and in Bun's built-in linter
import spin from "@spinjs/spin/eslint";

export default [
  spin.configs.recommended,
];
```

## Paired fills, semantic inks, and dark mode

Every fill token in your theme has a paired foreground ink role verified against WCAG contrast floors in every declared mode:

- **Brand & accent fills:** `bg-primary text-on-primary`, `bg-secondary text-on-secondary`, `bg-accent text-on-accent`
- **Semantic status fills:** `bg-semantic-success text-on-semantic-success`, `bg-semantic-warning text-on-semantic-warning`, `bg-semantic-error text-on-semantic-error`, `bg-semantic-info text-on-semantic-info`
- **Surfaces:** `bg-surface text-text`, `bg-surface-raised text-text`, `bg-surface-sunken text-text` (with `text-text-muted` for secondary copy)
- **Alpha modifier (`/0`–`/100`):** Any theme color supports an opacity percentage suffix (`bg-surface/80`, `border-primary/40`), compiling to `color-mix(in srgb, var(--color-surface) 80%, transparent)` without minting a new color token.

Spin switches light and dark palettes via `[data-mode="dark"]` on `<html>` or any container subtree. There is no `dark:` utility prefix — `bg-surface` and `text-text` resolve to the active mode's tokens automatically.

## State variants and responsive breakpoints

- **Interactive states:** `hover:`, `focus:`, `focus-visible:`, `active:`, `disabled:`, `aria-[current]:`, `data-[state=open]:`, `group-hover:`, `peer-hover:`
- **Responsive breakpoints:** `sm:`, `md:`, `lg:`, `xl:` — generated directly from your theme's `breakpoint.*` tokens (`@media (min-width: ...)`).

## Custom project shortcuts

In addition to the shipped `spinShortcuts` listed below, you can declare project-specific utility compositions in `spin.vite({ shortcuts: { ... } })`. Both the stylesheet compiler and `spin/closed-vocabulary` read `shortcuts` from your bundler config, and `spin lint` verifies that every utility inside your custom shortcut exists in your theme:

```ts
spin.vite({
  shortcuts: {
    "page-shell": "mx-auto w-full max-w-screen-lg px-6 py-10 stack-lg",
  },
});
```

<!-- USER COPY SLOT: css-close — your own edge notes or migration gotchas. -->
