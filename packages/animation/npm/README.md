# @spin/animation

Keyframes, and the utilities that name them. Motion is the one global namespace
in CSS, so it gets one home: every `@keyframes` in the system lives here, next
to the class that names it.

## Exports

```
@spin/animation
  animationCss            the stylesheet, as a string
  animationPreflights     the motion layer, as preflight providers
  animationContract       the keyframes, variants, and custom property reads
  animationVariants       the animate-* utility class names
  AnimationContract
```

`src/styles.ts` is generated from `src/animation.css` by `deno task codegen`.
The stylesheet stays a real `.css` file — for formatting and for tooling — and
nothing at runtime imports it.

## Contract

The shapes are the library's; the timing is the theme's. Every utility spends
the motion scale rather than naming a duration, so a theme sets the feel once
and every animation inherits it. No token is minted here: a theme moves every
animation by moving the scale.

Keyframes cannot be scoped or shaken, so this ships unconditionally. A component
that names a keyframe must never be shipped without its definition, and a
keyframe whose definition sits in a shakeable component file is a keyframe that
can ship without it.

The motion layer sits with the primitives rather than below them: an `animate-*`
class is a default an author overrides, and putting it lower would let a
component's own transitions beat it.

The manifest beside the stylesheet is the contract the CSS owns — the keyframes
it defines, the variants it claims, and the custom properties it reads — and it
is authored, not extracted from the CSS, so the knowledge sits where the author
already is. `deno task test` fails the suite when the two disagree.

## What it ships

Six utilities: `animate-spin`, `animate-ping`, `animate-pulse`,
`animate-fade-in`, `animate-slide-up`, and `animate-none` as the escape hatch
for overriding one at a breakpoint. The keyframes behind the dialog and backdrop
entrances, the indeterminate sweep and the loading pulse live in the same file.
