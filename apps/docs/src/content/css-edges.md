<!-- USER COPY SLOT: css-intro — your own mental model of the cascade, or the default below. -->

## The closed vocabulary

Any class whose token step does not exist in your theme emits **no CSS rule at all** — and `spin lint` flags it as `spin/closed-vocabulary`. Arbitrary bracket values (`p-[1rem]`, `w-[320px]`, `bg-[#ff0000]`) are blocked by design: if a visual value matters, declare it as a named token in your theme.

> **Warning:** A class outside the theme vocabulary produces no CSS rule in the stylesheet. When a utility has no effect, check your theme's declared steps first.

## The cascade layers

Spin emits styles into four ordered CSS layers so utilities always override element defaults without specificity wars:

1. **`reset`** (`-100`) — `box-sizing: border-box`, `border-width: 0`, and `[hidden] { display: none !important }`.
2. **`theme`** (`-90`) — `:root`, `[data-theme]`, and `[data-mode]` CSS custom properties, `@font-face` rules from `$extensions.spin.fonts`, `body` defaults, and the `prefers-reduced-motion: reduce` clamp.
3. **`primitives`** (`-50`) — classless HTML and Spin element rules plus `@spinjs/spin/animation` keyframes.
4. **`default` (utilities)** (`0`) — token-backed utility classes (`p-*`, `bg-*`, `text-*`, `rounded-*`, `shadow-*`), layout shortcuts (`stack`, `row`, `split`, `cluster`), and structural layout utilities (`flex`, `grid`, `items-*`, `justify-*`).

Spin switches light and dark palettes via `[data-mode="dark"]` on `<html>` or any container subtree. There is no `dark:` class prefix — `bg-surface` and `text-text` automatically resolve to the dark palette inside a dark subtree.

## State and responsive variants

- **Interactive states:** `hover:`, `focus:`, `focus-visible:`, `active:`, `disabled:`, `aria-[current]:`, `group-hover:`, `peer-hover:`
- **Responsive breakpoints:** `sm:`, `md:`, `lg:`, `xl:` (generated directly from your theme's `breakpoint.*` tokens)

## Layout shortcuts

Shortcuts compose common flex and typography patterns under a single class name (`stack`, `stack-xs`, `stack-sm`, `stack-lg`, `row`, `row-sm`, `row-lg`, `split`, `cluster`, `cluster-sm`, `cluster-lg`, `inline`, `overline`). Declare project-specific shortcuts in `spin.vite({ shortcuts: { ... } })` so both the stylesheet compiler and `spin lint` recognize them.
## Motion and animations

The `animate-*` utilities from `@spinjs/spin/animation` spend your theme's `motion.duration.*` and `motion.easing.*` tokens. Pair them with transition utilities (`transition-colors duration-fast ease-standard`) for state changes.

> **Note:** Continuous loop animations faster than `250ms` fail the `motion` theme gate and the `strobe-animation` browser check.

## Avoiding double-boxed fields

Native `<input>`, `<select>`, and `<textarea>` elements already carry their own border, padding, and `bg-field` background. When grouping an input with an icon or button inside a container, use the `<field>` primitive so the outer container owns the border and focus ring instead of drawing a box inside a box.

<!-- USER COPY SLOT: css-close — your own edge notes or migration gotchas. -->
