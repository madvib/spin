<!-- USER COPY SLOT: markup-intro — your own markup philosophy, or the default below. -->

## How classless elements work

With `classless: true` (the default), standard HTML tags and Spin custom elements arrive styled by your active theme with zero utility classes required on the element itself:

- **Actions:** `<button>`, `<breadcrumbs>`, `<join>`, `<kbd>`
- **Inputs:** `<input>`, `<select>`, `<textarea>`, `<checkbox>`, `<radio>`, `<switch>`, `<field>`, `<meter>`, `<label>`
- **Containers & layout:** `<card>`, `<panel>`, `<dialog>`, `<details>`, `<fieldset>`, `<hr>`
- **Display:** `<table>`, `<stat>`, `<swatch>`
- **Feedback & status:** `<alert>`, `<badge>`, `<progress>`, `<skeleton>`, `<tooltip>`
- **Typography:** `<prose>` (`<h1>`–`<h6>`, `<p>`, `<a>`, `<code>`, `<blockquote>`, `<small>`), `<icon>`

Browse every element, its variants, and the theme tokens it reads in the [Element directory](#directory) below or in the [Components catalog](/components?kind=elements).

## Buttons, variants, and `.bare`

A bare `<button>` renders with a neutral raised surface (`bg-surface-raised`) so secondary and toolbar actions never compete with your primary call to action. Opt into emphasis or size with element variant classes, or strip element chrome altogether with `class="bare"`:

```html
<div class="row">
  <button type="button" class="primary">Save changes</button>
  <button type="button">Neutral default</button>
  <button type="button" class="secondary">Secondary</button>
  <button type="button" class="outline">Outline</button>
  <button type="button" class="ghost">Ghost</button>
  <button type="button" class="danger">Delete</button>
</div>

<div class="row">
  <button type="button" class="primary s-sm">Small CTA</button>
  <button type="button" class="primary s-lg">Large CTA</button>
  <button type="button" class="bare inline-flex items-center gap-1 text-sm text-text-muted">
    Custom chrome-free trigger
  </button>
</div>
```

## Cards and containers

`<card>` works both as a standalone padded surface (`<card class="stack">...</card>`) and as a structured container composed from `<card-header>`, `<card-title>`, `<card-description>`, `<card-action>`, `<card-content>`, `<card-footer>`, and `<card-figure>`:

```html
<card>
  <card-header>
    <card-title>Billing notifications</card-title>
    <card-description>Receive an alert when monthly usage crosses your threshold.</card-description>
    <card-action>
      <badge variant="primary">Active</badge>
    </card-action>
  </card-header>
  <card-content class="stack-sm">
    <label>
      Alert email
      <input type="email" placeholder="ops@example.com" />
    </label>
  </card-content>
  <card-footer class="justify-end">
    <button type="button" class="ghost">Cancel</button>
    <button type="button" class="primary">Save</button>
  </card-footer>
</card>
```

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
