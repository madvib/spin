<!-- USER COPY SLOT: markup-intro — your own markup philosophy, or the default below. -->

## How the stylesheet layers work

Importing `spin/styles.css` compiles your `spin/*.json` theme into four ordered CSS `@layer` blocks:

1. **`reset`** (`-100`) — `box-sizing: border-box`, `border-width: 0`, and `[hidden] { display: none !important }`.
2. **`theme`** (`-90`) — `:root`, `[data-theme]`, and `[data-mode]` CSS custom properties, `@font-face` declarations from `$extensions.spin.fonts`, `body` defaults, and the `prefers-reduced-motion: reduce` clamp.
3. **`primitives`** (`-50`) — element rules for interactive controls, containers, feedback, and typography (`<button>`, `<card>`, `<field>`, `<table>`, `<prose>`).
4. **`default` (utilities)** (`0`) — closed-scale utility classes (`p-4`, `bg-surface-raised`, `rounded-md`) and layout shortcuts (`stack`, `row`, `split`, `cluster`).

Because `default` (`0`) sits above `primitives` (`-50`) in the cascade, **any utility class cleanly overrides a primitive's default styling** (`<card class="p-6 bg-surface-sunken">`) without specificity wars, `!important`, or runtime class-merging utilities like `twMerge`.

## Tag or class (`classless` is a preference)

Every primitive rule can match either the **element tag** (`<button>`, `<table>`, `<card>`) or an **explicit class** (`.button`, `.table`, `.card`):

- **`classless: true` (default):** Bare semantic HTML tags and Spin custom elements carry their primitive styling automatically.
- **`classless: false`:** Bare HTML tags remain unstyled until you opt in with `class="button"`, `class="table"`, `class="card"` — useful when adopting Spin incrementally inside an existing application.
- **`primitives: [...]` or `false`:** Ship only a subset of primitive rules, or pass `false` for a utility-only stylesheet.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { spin } from "@spinjs/spin/vite";

export default defineConfig({
  plugins: [
    spin.vite({
      // Default is true (<button>, <table>). Set false to require .button, .table:
      classless: false,
      // Or restrict which primitive rules are emitted:
      primitives: ["button", "card", "field", "table"],
    }),
  ],
});
```

## Variants, sizes, and `.bare`

Primitives keep everyday markup terse by expressing emphasis, tone, and size directly on the element:

- **Neutral default `<button>`:** A bare `<button>` renders with a neutral raised surface (`bg-surface-raised`) so toolbar and secondary actions never compete with your primary call to action. Add `.primary`, `.secondary`, `.contrast`, `.outline`, `.ghost`, or `.danger` to set emphasis, and `.s-sm` or `.s-lg` to change size.
- **Status tones (`variant="..."`):** Feedback primitives (`<badge>`, `<alert>`) take a `variant` attribute (`variant="primary"`, `variant="success"`, `variant="warning-muted"`, `variant="error"`) or the matching class (`.badge-primary`, `.alert-info`).
- **Stripping chrome with `.bare`:** When a `<button>` serves as a custom interactive trigger (such as a tab, accordion header, or unstyled icon button) that needs native `<button>` semantics and keyboard handling without button paint, border, shadow, or minimum height, add `class="bare"`.

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
  <button type="button" class="primary s-sm">Small</button>
  <button type="button" class="primary s-lg">Large</button>
  <button type="button" class="bare inline-flex items-center gap-1 text-sm text-text-muted hover:text-text">
    Chrome-free button (.bare)
  </button>
</div>
```

## Compound element anatomy

Container primitives coordinate spacing, borders, and typography across their child parts so you don't have to wire utility classes on every wrapper:

- **`<card>`:** Works standalone as a padded surface (`<card class="stack">...</card>`) or structured with `<card-header>`, `<card-title>`, `<card-description>`, `<card-action>`, `<card-content>`, `<card-footer>`, and `<card-figure>`.
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
  <card-content class="stack-sm">
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
