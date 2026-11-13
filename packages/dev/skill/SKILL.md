---
name: spin
description: |
  Build and verify UI in a Spin project using semantic HTML primitives,
  layout utilities, @spinjs/components statechart machines, the spin
  linter rules, and spin mcp.
---

# Building UI with Spin

Spin projects own a Brand: the token documents in `spin/<brand>/` that make
every element on the page. The user shapes them in Studio, or you shape them
through the `spin mcp` brand tools. Either way, markup spends the Brand —
markup never repaints it.

## How Spin divides UI work

Brand tokens live in `spin/<brand>/tokens.json` — every override the brand
states, over the design language its `$extends` names. (A monorepo may point
`themesDir` elsewhere, e.g. `packages/ui/spin/`; the shape inside is the
same.) `spin/config.json` holds project facts (`brand`, `componentsDir`,
`strictness`, `icons`), and `spin/shortcuts.json` holds the project's own
compositions. Never hardcode a color or a size in markup: no hex or pixel
literals, no inline `style="..."` attributes, no `<style>` blocks. A value
the theme cannot name belongs in the brand's `tokens.json` as a token, not
in the markup as a literal.

## Primitives first

Write native HTML and Spin custom elements, and they arrive styled from the
theme: `<button>`, `<input>`, `<select>`, `<label>`, `<dialog>`, `<table>`,
`<h1>`–`<h6>`, `<p>`, `<hr>`, and the `<card>`, `<card-header>`,
`<card-title>`, `<card-description>`, `<card-action>`, `<card-content>`,
`<card-footer>`, `<field>`, `<badge>`, `<alert>`, `<panel>`, `<stat>` family.

Never paint over an element's owned skin or typography with utility classes.
`<button class="bg-primary">` fails `spin/prefer-theme-value`: the button
already decides its fill, and a second opinion is a refusal, not a coat of
paint. Write `<button class="primary">` — the closed variant the primitive
declares. Use `.s-xs` / `.s-sm` / `.s-lg` for size variants, `.subtle` for
a quiet bordered control, and `.ghost` / `.card-ghost` / `.bare` only when
deliberately clearing chrome.

`<label class="flex items-center gap-2">` flows horizontally on its own: the
label primitive lays out, and utilities arrange inside it.

## Utilities for layout and surfaces

Spend utilities on arrangement (`flex`, `grid`, `items-center`,
`justify-between`, `gap-*`, `p-*`, `w-*`, `max-w-*`), on surfaces
(`bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `border`,
`rounded-*`, `shadow-*`), always pairing inks (`bg-primary text-on-primary`),
and on named text voices (`type-display`, `type-lead`, `type-body`,
`type-label`, `type-caption`, `type-overline`, `type-code`, `type-stat`,
`type-brand`). One `type-*` class spends the whole tuple — face, size,
weight, tracking, leading — at once. The exact catalog is
[references/primitives.md](references/primitives.md): every primitive's tag,
child parts, and closed variants, and every `type-*` style the theme
declares.

## Interactive statechart machines

Never hand-roll combobox, select, dialog, menu, tabs, popover, or date-picker
state and ARIA. List what ships and copy a working example into the project:

```bash
npx spin component list
npx spin component copy <name> <example>
```

Copying writes `src/lib/components/<name>.html`. Register once via
`import "spin/components"`, then bind with `useSpinComponent` (React),
`createSpinComponent` (Solid), or `spinComponentCtl` (Vue, Svelte, Vanilla) —
always cleaning up the `ctl.bind(...)` subscription in the framework effect
that created it. The template syntax, the per-framework bindings, and the
`spin mcp` equivalents are [references/components.md](references/components.md).

## Closed-loop verification

Run your linter (`npx oxlint .`) — or the `spin mcp` `findings` / `component` / `utility`
tools — and fix every finding before finishing. The lint reads the same
manifest the references are generated from, so a closed vocabulary the file
names is a closed vocabulary the build enforces.
