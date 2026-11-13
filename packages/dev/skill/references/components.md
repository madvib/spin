# Machine components reference

The `.html` component template syntax, the framework controllers that bind
it, and the CLI and MCP commands that list and copy it. For the exact
primitive vocabulary the templates spend — tags, child parts, closed
variants, `type-*` voices — read
[primitives.md](primitives.md), which is generated from the manifest.

## The CLI workflow

```bash
npx spin component list
npx spin component contract select
npx spin component copy select basic
```

Copying writes `src/lib/components/select.html`. On the next build or dev
start, the Spin plugin compiles it into `<app-select>` and updates
`src/spin-components.d.ts`.

## Registering project components

Import the virtual module once in the application entry to register all
compiled custom elements in `src/lib/components/*.html`:

```ts
// src/main.ts
import "spin/components";
```

## HTML template syntax

Each `.html` component combines a `<script lang="ts">` setup block with
reactive HTML template directives:

```html
<script lang="ts">
import { select } from "@spinjs/components";

const machine = select({
  value: "bun",
  items: [
    { value: "bun", label: "bun" },
    { value: "npm", label: "npm" },
  ],
});
</script>
<div {...machine.getRootProps()}>
  <button {...machine.getTriggerProps()}>
    <span {...machine.getValueTextProps()}>
      <template for={machine.getSelectedRows()} as={row} key={row.value}>
        <span>{row.label}</span>
      </template>
    </span>
  </button>
  <div {...machine.getPositionerProps()}>
    <panel {...machine.getContentProps()}>
      <template for={machine.getRows()} as={row} key={row.value}>
        <div {...machine.getItemProps(row)}>{row.label}</div>
      </template>
    </panel>
  </div>
  <select class="sr-only" {...machine.getHiddenSelectProps()}></select>
</div>
```

- **Part prop spreads (`{...machine.getTriggerProps()}`):** wire
  deterministic IDs, ARIA roles and states, keyboard handlers, and focus
  management.
- **Reactive loops (`<template for={...} as={row} key={row.value}>`):**
  keyed fine-grained list rendering.
- **Reactive conditionals (`<template if={machine.open}>`):** mount or
  toggle visibility from machine state.
- **Class arrays (`class={["base", { "bg-surface": machine.open }]}`):**
  toggle utility classes from state booleans.

## Framework controllers

```tsx
// React — useSpinComponent from @spinjs/components/react
import { useSpinComponent } from "@spinjs/components/react";
import { select } from "@spinjs/components";

const ref = useRef<HTMLElement>(null);
const ctl = useSpinComponent(ref, select);
useEffect(() => ctl.bind({ value: "bun" }), []);
return <app-select ref={ref} />;
```

```tsx
// Solid — createSpinComponent from @spinjs/components/solid
import { createSpinComponent } from "@spinjs/components/solid";
import { select } from "@spinjs/components";

const [element, setElement] = createSignal<HTMLElement>();
const ctl = createSpinComponent(element, select);
createEffect(() => ctl.bind({ value: "bun" }, {
  "value-change": (event) => console.log(event.detail.value),
}));
return <app-select ref={setElement} />;
```

```ts
// Vue, Svelte, Vanilla — spinComponentCtl from @spinjs/components/controller
import { spinComponentCtl } from "@spinjs/components/controller";
import { select } from "@spinjs/components";

const el = document.querySelector("app-select")!;
const ctl = spinComponentCtl(el, select);
const unbind = ctl.bind({ value: "bun" }, {
  "value-change": (event) => console.log(event.detail.value),
});
// Call unbind() when the host unmounts.
```

Always clean up the `ctl.bind(...)` subscription in the framework effect
that created it: the `useEffect` return in React, `onCleanup` in Solid,
`onUnmounted` in Vue, `onDestroy` in Svelte, the teardown callback in
Vanilla.

Project tags typecheck in every framework: `src/spin-components.d.ts`
augments the frameworks the project's manifest spends
(`declare module "react"`, `"solid-js"`, `"vue"`, `"svelte/elements"`),
and `@spinjs/dev/elements/<framework>` types the Spin elements the same
way. No framework is privileged; a project that names none falls back to
React and Solid.

## Variant attributes

A variant is a class or a `variant` attribute — the same opt-in, two
spellings. `<badge variant="primary">` and `<badge class="badge-primary">`
wear the same tone; `<button class="subtle s-xs">` is a quiet toolbar
control in the extra-small size, and `<button variant="subtle">` opts in
the same way for a document that carries its variants as data.

## The MCP equivalents

- `component` tool, `list` action: what `spin component list` prints.
- `component` tool, `contract` action: what `spin component contract`
  prints.
- `component` tool, `copy` action: what `spin component copy` writes.
- `findings` tool, `list` action: what the linter reports.
- `utility` tool: the utility classes a theme can produce, grouped by
  reader intent.
