<!-- USER COPY SLOT: css-intro — your own mental model of the cascade, or the default below. -->

# CSS & Edges

Six edges, each one a place where Spin behaves differently from utility CSS you
already know. Read them in order: each builds on the last.

## Edge 1 — Closed vocabulary, silent non-emission

Any class whose token step does not exist in the theme emits **no CSS rule at
all** — and the linter flags it as `spin/closed-vocabulary`. There is no warning
in the stylesheet; the class simply is not there.

Arbitrary bracket values are blocked by design: `p-[1rem]`, `w-[320px]`,
`bg-[#ff0000]`, `fill-[#000]`. If a value matters, it exists as a named token.
If it is not named, it does not ship.

**The half-step edge:** DTCG paths split on `.`, so `spacing.0.5` would parse as
nested group `0` → `5`. Standard themes only declare integer steps
(`0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 24, 32`). If your design needs a
half step, declare it with a non-dotted key in `spacing` (e.g. `"px"` or
`"half"`) — or reach for `px-1 py-1` and move on.

> **Warning:** A class that produces no CSS is invisible in the browser and
> invisible in a diff. When a utility seems to do nothing, check the theme
> first: the step is probably undeclared.

## Edge 2 — Cascade layers

The sheet emits three layers in this order: `preflights`, then `primitives`,
then `utilities`. `preflights.ts` carries the reset, the
`prefers-reduced-motion: reduce` clamp, `@font-face` blocks from
`$extensions.spin.fonts`, and the `body` defaults. Primitives sit in
`@layer primitives` alongside the `@spin/animation` keyframes, so utility
classes override element defaults by layer order — never by specificity wars.

## Edge 3 — What wind4 contributes, and what Spin blocks

`@unocss/preset-wind4` contributes the structural layout utilities: `flex`,
`grid`, `col-span-*`, `items-*`, `justify-*`, `overflow-*`, `relative`,
`absolute`, `inset-*`, `w-full`, `min-w-0`. Spin keeps those and blocks four
things:

1. wind4's preflights, which would emit broken self-referential
   `--spacing-2: var(--spacing-2)` declarations;
2. wind4 rules that overlap Spin's owned utility families (Spin's theme-derived
   rule wins);
3. wind4 rules that read unregistered `--un-*` properties (e.g. `from-primary`);
4. wind4's `dark:` class variant, disabled by default (`wind4: { dark: false }`)
   — Spin switches modes via `[data-mode="dark"]`, not a class.

## Edge 4 — Shortcuts

`spinShortcuts` is the project's shared class vocabulary: `cluster`, `stack`,
`row`, `split`, `panel`, `overline`, and their sizes. They compose utilities and
other shortcuts. They cannot compose a primitive rule — putting `button` inside
a shortcut string drops `button` silently, because a primitive is a selector
rule, not a class declaration.

Your own shortcuts go in `spin.vite({ shortcuts: { ... } })`, and
`@spin/diagnostics` reads static `shortcuts` object literals from
`vite.config.ts` so the lints validate them too. The live table below lists
every shipped shortcut and what it expands to.

## Edge 5 — Variants, states, and animation

State prefixes work the way you expect: `hover:`, `focus:`, `focus-visible:`,
`active:`, `disabled:`, `aria-[current]:`, `first:`, `last:`, `odd:`, `even:`,
`group-hover:`, `peer-hover:`. Responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`)
are generated from your theme's `breakpoint.*` tokens — no breakpoints declared,
no responsive variants emitted.

Animation utilities are global and come from `@spin/animation`: `animate-spin`,
`animate-ping`, `animate-pulse`, `animate-fade-in`, `animate-slide-up`,
`animate-none`. They spend `motion.duration.*` and `motion.easing.*`, so a theme
without motion tokens gets keyframes with no durations to run them.

## Edge 6 — Field vs input box

`<input>`, `<select>`, and `<textarea>` carry their own padding, border, and
`bg-field` from `field.ts`. Wrapping one in a custom bordered div builds a box
within a box. Either reset the inner control
(`border-transparent bg-transparent p-0`) or reach for the `<field>` / `<group>`
primitives, which own the box and let the control sit unboxed inside it.

<!-- USER COPY SLOT: css-close — your own edge notes or migration gotchas. -->
