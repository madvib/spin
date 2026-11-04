<!-- USER COPY SLOT: markup-intro — your own markup philosophy, or the default below. -->

## How the stylesheet layers work

Importing `spin/styles.css` compiles your `spin/*.json` theme into four ordered CSS `@layer` blocks:

1. **`reset`** (`-100`) — `box-sizing: border-box`, `border-width: 0`, and `[hidden] { display: none !important }`.
2. **`theme`** (`-90`) — `:root`, `[data-theme]`, and `[data-mode]` CSS custom properties, `@font-face` declarations from `$extensions.spin.fonts`, `body` defaults, and the `prefers-reduced-motion: reduce` clamp.
3. **`primitives`** (`-50`) — element rules for interactive controls, containers, feedback, and typography (`<button>`, `<card>`, `<field>`, `<table>`, `<prose>`).
4. **`default` (utilities)** (`0`) — closed-scale utility classes (`p-4`, `bg-surface-raised`, `rounded-md`). Your project's own compositions (`spin.vite({ shortcuts: { ... } })`) compile into this layer too.

Because `default` (`0`) sits above `primitives` (`-50`) in the cascade, **any utility class cleanly overrides a primitive's default styling** (`<card class="p-6 bg-surface-sunken">`) without specificity wars, `!important`, or runtime class-merging utilities like `twMerge`.

## Tag or class (`classless` toggles custom elements, never prose)

Three layers, from unconditional to opted-in: the reset is tokenless and
always ships; the base carries the document type (`h1`–`h6`, `p`, lists,
quotations, code) on its tags whatever the toggle says; the toggleable
custom elements (`button`, `table`, `card`) claim their bare tags by default
and only their classes with `classless: false`.

- **`classless: true` (default):** Bare semantic HTML tags and Spin custom elements carry their styling automatically.
- **`classless: false`:** Custom elements stay unstyled until you name them with `class="button"`, `class="table"`, `class="card"` — useful when adopting Spin inside an existing application. Prose (`h1`, `p`, `ul`, `blockquote`, `code`) keeps its tags: document type is base, not a preference.
- **`primitives: [...]` or `false`:** Ship only a subset of custom-element rules, or pass `false` for a utility-only stylesheet that still carries the base type.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { spin } from "@spinjs/spin/vite";

export default defineConfig({
  plugins: [
    spin.vite({
      // Custom elements only — prose keeps its tags either way:
      classless: false,
      // Or restrict which custom-element rules are emitted:
      primitives: ["button", "card", "field", "table"],
    }),
  ],
});
```

## Variants, sizes, and `.bare`

Primitives keep everyday markup terse by expressing emphasis, tone, and size directly on the element:

```html
<div class="flex items-center gap-4">
  <button type="button" class="primary">Save changes</button>
  <button type="button">Neutral default</button>
  <button type="button" class="secondary">Secondary</button>
  <button type="button" class="outline">Outline</button>
  <button type="button" class="ghost">Ghost</button>
  <button type="button" class="danger">Delete</button>
</div>

<div class="flex items-center gap-4">
  <button type="button" class="primary s-sm">Small</button>
  <button type="button" class="primary s-lg">Large</button>
  <button type="button" class="bare inline-flex items-center gap-1 text-sm text-text-muted">
    Chrome-free button (.bare)
  </button>
```


## Compound element anatomy

Container primitives coordinate spacing, borders, and typography across their child parts so you don't have to wire utility classes on every wrapper:

- **`<card>`:** Works standalone as a padded surface or structured with `<card-header>`, `<card-title>`, `<card-description>`, `<card-action>`, `<card-content>`, `<card-footer>`, and `<card-figure>`.
- **`<field>` (preventing double-boxed inputs):** Native `<input>`, `<select>`, and `<textarea>` elements already carry their own border, padding, and `bg-field` background. When grouping an input with a leading icon, prefix, or inline button, wrap them in `<field>` — the outer `<field>` claims the single border and focus ring instead of drawing a box inside a box.
- **`<prose>`:** Opt-in typographic measure and vertical rhythm (`<prose>` or `.prose`) for long-form copy and rendered Markdown (`<h1>`–`<h6>`, `<p>`, `<ul>`, `<ol>`, `<blockquote>`, `<code>`, `<pre>`).

```html
<card>
  <card-header>
    <card-title>Alert routing</card-title>
    <card-description>Notify on-call engineers when error budgets burn.</card-description>
    <card-action>
      <badge variant="success">Active</badge>
    </card-action>
  </card-header>
  <card-content class="flex flex-col gap-2">
    <label for="webhook-url">Webhook endpoint</label>
    <field>
      <span class="i-lucide-webhook icon-sm text-text-muted" aria-hidden="true"></span>
      <input id="webhook-url" type="url" placeholder="https://hooks.acme.dev/incidents" />
    </field>
  </card-content>
  <card-footer class="justify-end">
    <button type="button" class="ghost">Cancel</button>
    <button type="button" class="primary">Save rule</button>
  </card-footer>
</card>
```

## Automatic TypeScript types

When your bundler runs `spin.vite()` (or any Spin bundler adapter), Spin automatically generates `src/spin-components.d.ts`. That declaration file imports `@spinjs/spin/elements` and registers every Spin primitive tag (`<card>`, `<card-header>`, `<badge>`, `<field>`, `<alert>`, `<prose>`, `<stat>`, `<swatch>`, `<tooltip>`) alongside your project's compiled `lib/components/*.html` tags in `HTMLElementTagNameMap` and `JSX.IntrinsicElements` — with no framework-specific setup.

<!-- USER COPY SLOT: markup-close — framework notes or migration guidance. -->
