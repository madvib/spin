<!-- USER COPY SLOT: markup-intro — your own markup philosophy, or the default below. -->

# Markup & Elements

Write HTML. The theme dresses it.

Native elements arrive styled with no classes: `<button>`, `<input>`,
`<select>`, `<textarea>`, `<dialog>`, `<details>`, `<table>`, `<fieldset>`,
`<progress>`, `<meter>`, `<hr>`, `<kbd>`, `<label>` — plus type on
`<h1>`–`<h6>`, `<p>`, `<a>`, `<code>`, `<blockquote>`, and `<small>`.

The decisions no native tag owns live in Spin elements such as `<field>`,
`<panel>`, `<card>`, and `<badge>`. The current primitive and machine lists, with
their contracts, are on [Components](/components?kind=elements). Read the table
there rather than copying a list from this page: it is derived from the rules.

The rule is the same for both: the element owns its skin, and you spend
utilities on what it does not own.

## TypeScript

Solid projects add the shipped type augmentation once:

```ts
// src/spin.d.ts
import "@spinjs/spin/preset/solid";
```

The spin plugin generates `src/spin-components.d.ts` for your own
`lib/components` on the next dev start; it declares each tag for the DOM and
for Solid's JSX. Other frameworks declare the HTML tags in their own JSX
namespace if they need to.

The elements themselves are framework-agnostic — they are HTML the browser
already styles. The types are the only per-framework seam.

## Narrowing the library

`spin.vite({ primitives: ["button", "card"] })` ships a subset of the plugin's
primitives, and `spin.vite({ classless: false })` makes each primitive claim
only its own class, so third-party markup stays unstyled and your own
components opt in by name. The preset-only path takes the same fields:
`spinPreset({ primitives: ["button", "card"], classless: false })`.

<!-- USER COPY SLOT: markup-close — framework notes (React, Svelte) or migration guidance. -->
