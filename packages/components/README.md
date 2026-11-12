# @spinjs/components

Thirty-eight headless statechart machines and the platform controllers —
comboboxes, date pickers, carousels, menus, dialogs, and the rest — each with
copyable `.html` templates you own and restyle through your brand. The client
runtime (signals, elements, directives, machines) ships in this package too,
under `@spinjs/components/runtime`.

```sh
npm install @spinjs/components
```

```sh
npx spin component copy select basic
```

The copy lands at `src/lib/components/select.html`. The Spin plugin compiles it
into a standard custom element (`<app-select>`) with zero framework lock-in;
`import "spin/components"` registers every project component, and the plugin
generates `src/spin-components.d.ts` for DOM and JSX typechecking.

A machine is for states JS manages: anything the platform does not already hold
— open and closed, selected and highlighted, paging and dragging, commit and
revert. The guards and the gesture phases are states no one else holds. Where
the browser already owns the state (native `<dialog>`, `popover`,
`<details>`), a platform controller adapts it to the same contract shape.

## Driving a component

Every component exposes the same surface through its controller: `ctl.bind`
seats props and subscribes events, `ctl.commands.*` invokes machine commands,
and `ctl.state.*` reads reactive state.

```tsx
// Solid
import { createSpinComponent } from "@spinjs/components/solid";
import { select } from "@spinjs/components";

const ctl = createSpinComponent(element, select);
ctl.bind({ value: "bun" }, {
  "value-change": (event) => console.log(event.detail.value),
});
```

```tsx
// React
import { useSpinComponent } from "@spinjs/components/react";
```

```ts
// Vanilla DOM, Vue, Svelte
import { spinComponentCtl } from "@spinjs/components/controller";
```

## Subpaths

One subpath per component (`@spinjs/components/select`,
`@spinjs/components/combobox`, `@spinjs/components/date-picker`, and the other
thirty-five), plus:

- `@spinjs/components/react` — `useSpinComponent`.
- `@spinjs/components/solid` — `createSpinComponent`.
- `@spinjs/components/controller` — `spinComponentCtl`.
- `@spinjs/components/spin-element` — the custom-element base.
- `@spinjs/components/runtime` — signals, elements, directives, machines.
- `@spinjs/components/fsm` — the statechart core.
- `@spinjs/components/props` — prop parsing.
- `@spinjs/components/load` — the load directive.
- `@spinjs/components/actions` — gesture and overlay actions.
- `@spinjs/components/testing` — `parseHTML` and test helpers.
- `@spinjs/components/compiler` — the `.html` transform.
- `@spinjs/components/examples` — example sources and machines.
