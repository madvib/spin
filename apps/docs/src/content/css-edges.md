<!-- USER COPY SLOT: css-intro — your own mental model of the cascade, or the default below. -->

## The closed vocabulary

Every utility class in Spin maps to a declared token in your `spin/<brand>/` theme (`p-4` → `var(--spacing-4)`, `bg-surface-raised` → `var(--color-surface-raised)`, `rounded-md` → `var(--radius-md)`). If a token step is not declared in your theme — or if you write an arbitrary bracket value (`w-[320px]`, `bg-[#ff0000]`) or a misspelled role (`bg-success` instead of `bg-semantic-success`) — the preset emits **no CSS rule**, and the build fails telling you which class, in which file, and what to write instead.

The lint reads your project's themes and enforces the closed vocabulary in your editor and CI — the same rules everywhere, no `uno.config.ts` required. See [Lints & Verification](/docs/tooling/lints) for the rule table and setup.

## Color roles, paired inks, and dark mode

Every painted fill role in your theme has a paired foreground ink verified against WCAG contrast floors across light and dark modes (see [Palettes & Paired Inks](/docs/themes/palettes) and [Color & Alpha Utilities](/docs/styling/color)). Any theme color also accepts an `/0`–`/100` opacity suffix (`bg-surface/80`, `border-primary/40`), compiling to `color-mix(in srgb, ...)` without minting a new token.
## State variants and responsive breakpoints

- **Interactive states:** `hover:`, `focus:`, `focus-visible:`, `active:`, `disabled:`, `aria-[current]:`, `data-[state=open]:`, `group-hover:`, `peer-hover:`
- **Responsive breakpoints:** `sm:`, `md:`, `lg:`, `xl:` — generated directly from your theme's `breakpoint.*` tokens (`@media (min-width: ...)`).

## Project shortcuts

Spin ships no shortcuts of its own. Declare the compositions your app repeats in `spin.vite({ shortcuts: { ... } })` — the worked example lives on [Install &amp; Bundlers](/docs/getting-started/install#config). Both the stylesheet compiler and `spin/closed-vocabulary` read `shortcuts` from your bundler config, and the linter verifies that every utility inside your custom shortcut exists in your theme:

```ts
spin.vite({
  shortcuts: {
    "page-shell": "mx-auto w-full max-w-screen-lg px-6 py-10",
  },
});
```

<!-- USER COPY SLOT: css-close — your own edge notes or migration gotchas. -->
