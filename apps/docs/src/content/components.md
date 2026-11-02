<!-- USER COPY SLOT: components-intro — your own component philosophy, or the default below. -->

# Components & Templates

Write a component once, in HTML, and mount it anywhere: React, Solid, Vue,
Svelte, Astro, or plain HTML, on any of the seven bundler plugins. The Spin
plugin compiles `lib/components/<name>.html` into a standard custom element
(`<prefix>-<name>`) with zero framework lock-in — the component is a DOM
element any host can create, and the theme styles it wherever it lands.

The library side of that contract — thirty-seven headless statechart machines
plus the platform controllers — ships in `@spinjs/components`. Each one has
copyable `.html` templates you own: copy, restyle through the theme, and the
machine stays shared.

## The CLI workflow

List what the library carries, read one component's contract, and copy the
recipe you want into your project:

```bash
npx spin component list
npx spin component contract select
npx spin component copy select basic
```

The copy lands at `lib/components/select.html`. The plugin compiles it on the
next dev start into `<app-select>` (or your configured `--prefix`), and
regenerates `src/spin-components.d.ts` so the tag typechecks in the DOM and in
JSX.

## Registration

One import registers every project component:

```ts
// src/main.ts — the entry your bundler reads
import "spin/components";
```

The plugin answers for `spin/components` as a virtual module: it registers each
compiled element under its tag and emits the matching type declarations. No
registration calls, no globals, no per-component imports.

## The template syntax

A `.html` component is a `<script lang="ts">` block plus markup. The script
instantiates the machine; the markup spreads its part props, loops its rows,
and branches on its state:

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

The pieces, each doing one job:

- **The script block** imports the machine factory from `@spinjs/components`
  and calls it with the component's data. Props down from the host element
  arrive through the bridge the plugin generates.
- **Part prop spreads** (`{...machine.getRootProps()}`, `{...machine.getTriggerProps()}`,
  `{...machine.getItemProps(row)}`) carry the ARIA roles, ids, tabindex, and
  event wiring each part needs. A part without its spread is unpainted
  behaviorally — the ids the machine coordinates will not exist.
- **Reactive loops** (`<template for={machine.getRows()} as={row} key={row.value}>`)
  render one subtree per row and update when the signal updates. The `key`
  keeps focus and selection stable across re-renders.
- **Reactive branches** (`<template if={machine.open}>`) mount and unmount a
  subtree on a boolean signal.
- **Conditional class arrays** (`class={["base", { "bg-surface": machine.open }]}`)
  toggle utility classes on machine state, grouped under one key per boolean.
- **Event and action directives** (`on:click={...}`, `use:anchor={...}`)
  attach listeners and element actions — `anchor`, `drag`, `hover-delay`,
  `interact-outside`, `form-control`, `scroll-into-view`, `observe` — from
  `@spinjs/runtime/actions`.

## Driving components from a host framework

A compiled element is a DOM element: any framework mounts it with a tag. The
typed controllers in `@spinjs/components` drive it from the host side:

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

Every controller exposes the same surface: `ctl.bind(props, listeners)` seats
props and subscribes events, `ctl.commands.*` invokes machine commands, and
`ctl.state.*` reads reactive state. The demo below is the docs' own
`<docs-select>` — copied, owned, and driven live.

<!-- USER COPY SLOT: components-close — framework notes or migration guidance. -->
