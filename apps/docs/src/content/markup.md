<!-- USER COPY SLOT: markup-intro — your own markup philosophy, or the default below. -->

## How classless elements work

Native HTML tags and Spin custom elements arrive styled by your active theme with zero utility classes required on the element itself:

- **Interactive controls:** `<button>`, `<input>`, `<select>`, `<textarea>`, `<label>`, `<fieldset>`
- **Containers & overlays:** `<dialog>`, `<details>`, `<card>`, `<panel>`, `<field>`, `<alert>`
- **Data & indicators:** `<table>`, `<progress>`, `<meter>`, `<badge>`, `<stat>`, `<swatch>`, `<skeleton>`, `<kbd>`, `<hr>`
- **Typography (`<prose>`):** `<h1>`–`<h6>`, `<p>`, `<a>`, `<code>`, `<blockquote>`, `<small>`

Browse every element, its variants, and the theme tokens it reads in the [Components catalog](/components?kind=elements).

## TypeScript setup

Solid projects add the shipped type augmentation once so custom Spin tags typecheck in JSX:

```ts
// src/spin.d.ts
import "@spinjs/spin/preset/solid";
```

For project components under `lib/components/*.html`, the Spin bundler plugin generates `src/spin-components.d.ts` automatically on dev start or build.

## Narrowing or disabling classless rules

Pass `primitives` to ship only a subset of element rules, or set `classless: false` so elements require explicit opt-in classes:

```ts
spin.vite({
  primitives: ["button", "card", "field"],
  classless: false,
});
```

The standalone UnoCSS preset accepts the same options: `spinPreset({ primitives: ["button", "card"], classless: false })`.

<!-- USER COPY SLOT: markup-close — framework notes (React, Svelte) or migration guidance. -->
