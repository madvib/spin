<!-- USER COPY SLOT: css-intro — your own mental model of the cascade, or the default below. -->

# Utilities & Animations

Utilities cover layout and the decisions the elements leave open. Every utility
spends a theme token; a value the theme does not declare generates no CSS.
This page is the map: the closed vocabulary, the three cascade layers, the
state and responsive variants, the layout shortcuts, and the theme-driven
animations.

## The closed vocabulary

Any class whose token step does not exist in the theme emits **no CSS rule at
all** — and the linter flags it as `spin/closed-vocabulary`. There is no
warning in the stylesheet; the class simply is not there. Arbitrary bracket
values are blocked by design: `p-[1rem]`, `w-[320px]`, `bg-[#ff0000]`. If a
value matters, it exists as a named token. If it is not named, it does not
ship.

The live tables below read the active theme, so they are the vocabulary — the
spacing scale lists every `p-*`, `gap-*`, and `m-*` step this theme can spend,
and the shortcuts table lists every shipped composition and its expansion.
Switch the starter in the header and both re-derive.

DTCG paths split on `.`, so fractional steps need non-dotted keys: declare the
step as `"px"` or `"half"` under `spacing` rather than `spacing.0.5`, which
would parse as nested group `0` → `5`.

> **Warning:** A class that produces no CSS is invisible in the browser and
> invisible in a diff. When a utility seems to do nothing, check the theme
> first: the step is probably undeclared.

## The three layers

The sheet emits three cascade layers in order: `preflights`, then `primitives`,
then `utilities`. The preflights carry the reset, the
`prefers-reduced-motion: reduce` clamp, `@font-face` blocks from
`$extensions.spin.fonts`, and the `body` defaults. Primitives sit in
`@layer primitives` beside the `@spinjs/spin/animation` keyframes. Utilities
come last — so a utility class always overrides an element default by layer
order, never by specificity wars.

The structural layout utilities — `flex`, `grid`, `col-span-*`, `items-*`,
`justify-*`, `overflow-*`, `relative`, `absolute`, `inset-*`, `w-full`, `min-w-0`
— come from `@unocss/preset-wind4`. Spin switches modes via
`[data-mode="dark"]`, not a class, so there is no `dark:` variant: the same
`bg-surface` utility resolves to the dark surface inside a dark subtree and
the light surface outside it.

## State and responsive variants

State prefixes work the way you expect: `hover:`, `focus:`, `focus-visible:`,
`active:`, `disabled:`, `aria-[current]:`, `first:`, `last:`, `odd:`, `even:`,
`group-hover:`, `peer-hover:`. Responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`)
are generated from your theme's `breakpoint.*` tokens — no breakpoints
declared, no responsive variants emitted.

## Layout shortcuts

The shipped shortcuts compose utilities under one name: `stack` and `stack-sm`
for vertical rhythm, `row` for a horizontal run, `split` for space-between,
`panel` for a padded surface, `row-list` for a horizontal list and `flow-list`
for a vertical one. They compose utilities and other shortcuts — never a
primitive rule, which is a selector rather than a class declaration.

Your own shortcuts go in `spin.vite({ shortcuts: { ... } })`, and the lint
reads the same declaration out of the same config, so a class your app
declares is a class the lint knows.

## Animations

The `animate-*` utilities come from `@spinjs/spin/animation`:
`animate-spin`, `animate-ping`, `animate-pulse`, `animate-fade-in`,
`animate-slide-up`, `animate-none`. They spend `motion.duration.*` and
`motion.easing.*`, so a theme moves its motion by moving those two ramps and
every animation follows. Pair them with the transition utilities —
`transition-colors duration-fast ease-standard` — for state changes; reach for
the Motion page in the Studio to tune the curves live.

> **Note:** Animations cycling faster than `250ms` read as a fault, not motion.
> The `strobe-animation` browser check flags them.

## Fields and their boxes

`<input>`, `<select>`, and `<textarea>` carry their own padding, border, and
`bg-field`. Wrapping one in a custom bordered div builds a box within a box.
Either reset the inner control (`border-transparent bg-transparent p-0`) or
reach for the `<field>` / `<group>` primitives, which own the box and let the
control sit unboxed inside it.

<!-- USER COPY SLOT: css-close — your own edge notes or migration gotchas. -->
