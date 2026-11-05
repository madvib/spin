## Tags arrive finished

Write `<button>`, `<card>`, or `<input>` directly in your template and get a finished control with its padding, border, corner radius, focus ring, and interactive states already in place. Because your theme decides how a control looks once in `spin/<name>.json`, every `<button>`, `<card>`, and `<input>` across your application agrees without a utility list repeated on every tag.

```html
<div class="flex flex-wrap items-center gap-2">
  <button type="button" class="primary">Save changes</button>
  <button type="button">Neutral</button>
  <button type="button" class="secondary">Secondary</button>
  <button type="button" class="outline">Outline</button>
  <button type="button" class="ghost">Ghost</button>
  <button type="button" class="danger">Delete</button>
</div>
```

Compose `<card>` with `<card-header>`, `<card-title>`, `<card-description>`, `<card-action>`, `<card-content>`, `<card-footer>`, and `<card-figure>` when a surface needs structured regions, or wrap an `<input>` and an inline icon inside `<field>` so the outer box carries the single border and focus ring instead of drawing a box inside a box. Every primitive tag is registered in `src/spin-components.d.ts` when your bundler runs `spin.vite()`, so TypeScript and JSX autocomplete `<card>`, `<field>`, `<badge>`, and `<alert>` alongside native HTML elements (browse all 28 primitives in the [Components catalog](/components?kind=elements)):

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
    <label for="oncall-channel">Escalation channel</label>
    <input id="oncall-channel" type="text" value="#incidents-primary" />
    <label for="webhook-url">Webhook endpoint</label>
    <field>
      <span class="i-lucide-webhook icon-sm" aria-hidden="true"></span>
      <input id="webhook-url" type="url" placeholder="https://hooks.acme.dev/incidents" />
    </field>
  </card-content>
  <card-footer class="justify-end">
    <button type="button" class="ghost">Cancel</button>
    <button type="button" class="primary">Save rule</button>
  </card-footer>
</card>
```

## Atomic CSS: you ship what you use

Use `<card>` on a page without `<card-footer>` or `<card-figure>` and your stylesheet emits `326 B` minified (`200 B` gzipped) for `<card>` alone — unused child tags and variants emit zero bytes because each primitive tag, child part, and variant class is an independent atomic rule generated on demand by UnoCSS. Across the 3-control slice above (`<button class="primary">`, `<card>` with `<card-header>`, `<card-title>`, and `<card-content>`, and `<input>`) and across the 22 components shared by both libraries (`alert`, `badge`, `breadcrumbs`, `button`, `card`, `checkbox`, `details`/`collapse`, `dialog`/`modal`, `field`/`input`+`textarea`+`select`, `fieldset`, `hr`/`divider`, `join`, `kbd`, `label`, `progress`, `radio`, `range`, `skeleton`, `stat`, `switch`/`toggle`, `table`, and `tooltip`), compiling equivalent markup against `@spinjs/spin` (`starterThemes.spin`) versus daisyUI `5.7.50` on `@tailwindcss/node` `4.3.2` measures as follows (on an empty page with zero components, Spin's reset, light/dark token variables, and base document typography start at `14.47 kB` minified / `2.55 kB` gzipped versus daisyUI's `10.56 kB` minified / `2.76 kB` gzipped):

| Workload | Spin (rules only) | daisyUI 5.7.50 (rules only) | Spin (full sheet) | daisyUI 5.7.50 (full sheet) |
| --- | --- | --- | --- | --- |
| Single `<card>` vs `.card` + `.card-body` | `0.33 kB` min (`0.20 kB` gz) | `4.70 kB` min (`1.54 kB` gz) | `14.80 kB` min (`2.67 kB` gz) | `12.68 kB` min (`3.26 kB` gz) |
| 3 controls (`button` + `card` + `input`) | `8.09 kB` min (`1.60 kB` gz) | `18.40 kB` min (`3.49 kB` gz) | `22.56 kB` min (`3.97 kB` gz) | `26.37 kB` min (`5.09 kB` gz) |
| All 22 shared primitives (base markup) | `23.65 kB` min (`4.02 kB` gz) | `75.67 kB` min (`10.03 kB` gz) | `38.12 kB` min (`6.27 kB` gz) | `83.64 kB` min (`11.62 kB` gz) |

## Variants change paint; tokens customize your component

Add `.primary`, `.secondary`, `.outline`, `.ghost`, `.contrast`, or `.danger` (or `variant="primary"` on elements like `<badge>` and `<alert>`) when one instance on the page needs a different emphasis or status tone, and add `.s-sm` or `.s-lg` when a control needs a compact or prominent size. When a custom trigger — a tab chip, a disclosure header, or an inline command button — needs native `<button>` semantics and keyboard focus without wearing button chrome, add `.bare` to strip the fill, border, radius, shadow, and minimum height (see [The bare escape](/docs/styling/space#bare-escape)):

```html
<div class="flex flex-wrap items-center gap-2">
  <button type="button" class="primary s-sm">Small primary (.s-sm)</button>
  <button type="button" class="primary">Default primary</button>
  <button type="button" class="primary s-lg">Large primary (.s-lg)</button>
  <button type="button" class="ghost">Ghost (.ghost)</button>
  <button type="button" class="danger">Delete (.danger)</button>
  <button type="button" class="bare inline-flex items-center gap-1">
    <span>Chrome-free (.bare)</span>
  </button>
</div>
```

Reach for a variant when one button on a screen plays a different role; reach for component tokens in `spin/<name>.json` (`button.radius`, `button.shadow`, `card.radius`, `card.padding`, `field.radius`) when you want to change what *your* button, card, or field looks like everywhere (see [Theme Customization](/docs/themes/customization#elements) and [Per-Element Token Overrides](/docs/themes/reference#elements)). Every UI surface in Spin climbs one three-step staircase so no layer pretends the others don't exist: your **theme** (`spin/*.json`) sets the palette, scales, and per-element tokens; **primitives** (`<button>`, `<card>`, `<input>`, `<field>`) turn single HTML and custom tags into finished controls for static and native interactions; and when a widget needs multi-part state orchestration, keyboard navigation, and roving focus — a combobox, select, tabs, dialog, or menu — you **vendor a state-machine component** into `lib/components/` with `npx spin component copy <name> <example>` so you own its markup the same way shadcn/ui vendors templates while the theme and primitives still style every part inside it (see the [Components catalog](/components)).

## How the system reasons about your markup

Write markup against primitives and utilities and run `npx spin lint .` (see [Lints](/docs/tooling/lints)) to verify four promises that keep your templates consistent across theme and mode switches:

1. **Elements arrive with their look decided.** Write `<button>` or `<h1>` and its default weight, size, and surface are already set; restating the same value in a utility class adds noise without changing a pixel, so `spin/no-redundant-class` flags the duplicate class and removes it on `--fix`:

```html
<!-- Flagged by spin/no-redundant-class: -->
<button type="button" class="font-medium">Save changes</button>
<!-- `font-medium` sets `font-weight` to what `<button>` already sets. Drop the class. -->

<!-- Remedy (Drop `font-medium`): -->
<button type="button">Save changes</button>
```

2. **Recurring look changes belong to variants or the theme.** Change how a control is painted or sized by choosing one of its variants (`.primary`, `.ghost`, `.danger`, `.s-sm`, `.s-lg`) or by updating its tokens in `spin/<name>.json`; when a utility class overrides an element's fill, size, or typography for a one-off, `spin/prefer-theme-value` flags the collision and names the variants or theme value to use instead:

```html
<!-- Flagged by spin/prefer-theme-value: -->
<button type="button" class="bg-accent text-on-accent">Publish</button>
<!-- `<button>` sets its own fill; `bg-accent` fights it. Use a variant (`primary`, `secondary`, `outline`, `ghost`, `contrast`, `danger`, or `bare`) or the theme's value. -->

<!-- Remedy: -->
<button type="button" class="primary">Publish</button>
```

3. **Semantic tags carry the typography the theme gave them.** Reach for `<h1>`–`<h6>`, `<p>`, or `<code>` when text plays that role on the page rather than styling a `<div>` or `<span>` to imitate one; when an unstyled box reaches for a typographic size or tracking that belongs to a semantic element, `spin/prefer-element` names the tag to write instead:

```html
<!-- Flagged by spin/prefer-element: -->
<div class="text-2xl">Incident summary</div>
<!-- the theme gives `<h1>` that size; `<div>` is not the element that carries it. Put the class on `<h1>`. -->

<!-- Remedy (Put the class on `<h1>`.): -->
<h1>Incident summary</h1>
```

4. **Layout is free, look is owned.** Position, align, and space primitives freely with layout utilities (`flex`, `grid`, `items-center`, `justify-between`, `gap-3`, `w-full`, `mt-4`) — where an element sits on the page is always your template's call, while how the control itself is painted and typed stays with the primitive and your theme:

```html
<card>
  <card-content class="flex flex-wrap items-center justify-between gap-3">
    <strong>Production traffic</strong>
    <badge variant="success">Healthy</badge>
  </card-content>
  <card-footer class="justify-end">
    <button type="button" class="ghost">Inspect</button>
    <button type="button" class="primary">Promote</button>
  </card-footer>
</card>
```

## Incremental adoption

Pass `primitives: [...]` to `spin.vite()` (or `spinPreset()`) when introducing Spin into an existing application so only the element rules you name are active while you migrate screen by screen, or pass `primitives: false` for a utility-only stylesheet that keeps the reset and base document typography (`h1`–`h6`, `p`, lists, `blockquote`, `code`) without styling any control or container tags:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { spin } from "@spinjs/spin/vite";

export default defineConfig({
  plugins: [
    spin.vite({
      // Opt in to specific primitives while migrating an existing app:
      primitives: ["button", "card", "field"],
    }),
  ],
});
```
