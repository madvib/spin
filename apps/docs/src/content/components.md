<!-- USER COPY SLOT: components-intro — your own component philosophy, or the default below. -->

## The CLI workflow

List available components, inspect a component's machine contract, and copy its `.html` template into your project:

```bash
npx spin component list
npx spin component contract select
npx spin component copy select basic
```

Copying writes `src/lib/components/select.html`. On the next build or dev start, the Spin plugin compiles it into `<app-select>` (using your configured `--prefix`) and updates `src/spin-components.d.ts`.

## Registering project components

Import the virtual module once in your application entry to register all compiled custom elements in `src/lib/components/*.html`:

```ts
// src/main.ts
import "spin/components";
```

## HTML template syntax

Each `.html` component combines a `<script lang="ts">` setup block with reactive HTML template directives:

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

- **Part prop spreads (`{...machine.getTriggerProps()}`):** Wire deterministic IDs, ARIA roles/states, keyboard handlers, and focus management.
- **Reactive loops (`<template for={...} as={row} key={row.value}>`):** Keyed fine-grained list rendering.
- **Reactive conditionals (`<template if={machine.open}>` / `show={...}`):** Mount or toggle visibility from machine state.
- **Class arrays (`class={["base", { "bg-surface": machine.open }]}`):** Toggle utility classes from state booleans.
- **Directives (`on:click={...}`, `use:anchor={...}`):** Attach DOM listeners and actions from `@spinjs/components/actions`.

## Framework controllers

Drive any mounted Spin custom element from Solid, React, Vue, Svelte, or vanilla DOM using the typed controller adapters:

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

```tsx
// React — useSpinComponent from @spinjs/components/react
import { useSpinComponent } from "@spinjs/components/react";
import { select } from "@spinjs/components";

const ref = useRef<HTMLElement>(null);
const ctl = useSpinComponent(ref, select);
useEffect(() => ctl.bind({ value: "bun" }), []);
return <app-select ref={ref} />;
```

```ts
// Vanilla DOM, Vue, Svelte — spinComponentCtl from @spinjs/components/controller
import { spinComponentCtl } from "@spinjs/components/controller";
import { select } from "@spinjs/components";

const el = document.querySelector("app-select")!;
const ctl = spinComponentCtl(el, select);
ctl.bind({ value: "bun" }, {
  "value-change": (event) => console.log(event.detail.value),
});
```

<!-- USER COPY SLOT: components-close — framework notes or migration guidance. -->
