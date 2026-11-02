<!-- USER COPY SLOT: machines-intro — your own state philosophy, or the default below. -->

# Authoring Machines

Everything interactive in Spin — the thirty-seven library components and your
own — is a statechart over fine-grained signals. `@spinjs/runtime` is that
layer: signals for reactivity, `createMachine` and `interpret` for state,
`defineComponent` for synthesizing a component the template compiler can mount,
`defineController` for the cases where the browser already owns the state, and
`createAction` for DOM directives.
## Signals

The reactive core, imported from `@spinjs/runtime`:

```ts
import { batch, computed, effect, scope, signal, untrack } from "@spinjs/runtime";

const count = signal(0);
const doubled = computed(() => count() * 2);
effect(() => console.log("count:", count(), "doubled:", doubled()));
count(1);          // logs count: 1 doubled: 2
batch(() => {      // one notification for many writes
  count(2);
  count(3);
});
const raw = untrack(() => count());  // read without subscribing
const owner = scope();               // dispose a subtree of effects at once
```

Signals are fine-grained: an effect re-runs only when a signal it actually read
changes. Templates subscribe through directives (`<template for>`, `<template if>`,
`class={[...]}`, `{...spread}`), so a machine's state change repaints exactly
the subtrees that read it.

## Statecharts

Machines come from `@spinjs/runtime/fsm`. Author the spec once — states,
transitions, guards, context writes — and interpret it per instance:

```ts
import { createMachine, interpret } from "@spinjs/runtime/fsm";

interface ToggleContext { presses: number }
type ToggleEvent = { type: "PRESS" } | { type: "RESET" };

const toggle = createMachine<ToggleContext, ToggleEvent, "off" | "on">({
  initial: "off",
  context: { presses: 0 },
  states: {
    off: {
      on: {
        PRESS: {
          target: "on",
          assign: (context) => ({ presses: context.presses + 1 }),
        },
      },
    },
    on: {
      on: {
        PRESS: [
          { cond: (context) => context.presses >= 10, target: "off" },
          { assign: (context) => ({ presses: context.presses + 1 }) },
        ],
        RESET: { target: "off", assign: () => ({ presses: 0 }) },
      },
    },
  },
});

const actor = interpret(toggle);
actor.send({ type: "PRESS" });
actor.state.value;    // "on"
actor.state.context;  // { presses: 1 }
```

A transition is a target state name or a record with an optional `target`, a
`cond` guard, and `assign` context writes. A list of candidates is tried in
order — the first whose guard passes wins. `assign` is a pure transform
returning a partial context; entry and exit hooks fold the same way.

## Synthesizing a component

`defineComponent` turns a `ComponentDef` into a `DefinedComponent` — the
callable the script block invokes, the template compiler mounts, and the
framework adapters drive:

```ts
import { defineComponent } from "@spinjs/runtime";

export const toggle = defineComponent({
  name: "toggle",
  machine: (args) => toggleMachine(args),
  args: (resolved) => ({ ...resolved, presses: 0 }),
  parts: {
    root: { /* id, ARIA, and prop getters */ },
    trigger: { /* ... */ },
  },
  slots: { /* named insertion points */ },
  scalars: ["presses"],
  scalarsOf: (context) => ({ presses: context.presses }),
  readers: {
    on: { read: (_context, state) => state === "on" },
    presses: { read: (context) => context.presses },
  },
  methods: {
    getPressCount: { call: (context) => context.presses },
  },
  commands: {
    press: { event: () => ({ type: "PRESS" }) },
    reset: { event: () => ({ type: "RESET" }) },
  },
  events: {
    "press-change": { on: "onPressChange" },
  },
});
```

The definition's pieces:

- **`name`** — the component's identity, used for ids and diagnostics.
- **`machine`** — the factory returning the interpreted actor per instance.
- **`args`** — normalizes host props into machine input.
- **`parts`** — the named elements (`root`, `trigger`, `content`, …), each
  with its id segments, ARIA, and `get*Props` getters.
- **`slots`** — named insertion points the template fills.
- **`readers`** — reactive state projections (`ctl.state.on`).
- **`methods`** — computed values the template calls (`machine.getRows()`).
- **`commands`** — events the host sends (`ctl.commands.press()`).
- **`events`** — the out-side: each CustomEvent name mapped to the callback
  prop that fires it.

From that one definition, `defineComponent` derives `.fields` (the reactive
field signals), `.events` (the DOM event contract), `.manifest` (parts, slots,
readers, methods, commands, events), and `.createBridge()` (the per-instance
wiring the plugin's codegen and the adapters share).

## Platform controllers

Some elements already own their state in the browser: a native `<dialog>`, a
`popover`, a `<details>`. `defineController` is the lightweight definition for
those — an `attach(el)` that wires the platform element, without a machine:

```ts
import { defineController } from "@spinjs/runtime";

export const popover = defineController({
  name: "popover",
  attach(el: Element) {
    // wire the platform popover API, return the component API
    return { show() { /* ... */ }, hide() { /* ... */ } };
  },
});
```

Controllers export their `<name>Manifest` alongside the definition, and the
machine-component pages read the same contract shape — parts, slots, readers,
methods, commands, events — so controllers and machines document identically.

## DOM actions

Directives come from `@spinjs/runtime/actions`. The library ships `anchor`
(popover positioning), `drag`, `hover-delay`, `interact-outside`,
`form-control`, `scroll-into-view`, `observe`, `dismissable`, and `autoplay` —
and `createAction` authors your own:

```ts
import { createAction, type ElementAction } from "@spinjs/runtime/actions";

export interface LogParam { readonly label: string }

export const logMount: ElementAction<LogParam | undefined> =
  createAction((node, param) => {
    console.log("mounted:", param?.label ?? node.tagName);
    return () => console.log("unmounted:", param?.label ?? node.tagName);
  });
```

An action receives the node and its param, and returns a cleanup. Templates
spend them with `use:log-mount={{ label: "panel" }}`; the runtime runs the
setup on mount and the cleanup on unmount.

<!-- USER COPY SLOT: machines-close — your own patterns or migration guidance. -->
