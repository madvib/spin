<!-- USER COPY SLOT: machines-intro — your own state philosophy, or the default below. -->

## Signals

The fine-grained reactive core in `@spinjs/runtime`:

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

Effects re-run only when a signal they read changes. Compiled `.html` templates subscribe through `<template for>`, `<template if>`, `class={[...]}`, and part prop spreads so state transitions update only the affected DOM nodes.

## Statecharts

Author finite-state machines with `createMachine` and `interpret` from `@spinjs/runtime/fsm`:

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

## Synthesizing a component

`defineComponent` turns a `ComponentDef` into a `DefinedComponent` that the `.html` compiler mounts and framework controllers drive:

```ts
import { defineComponent } from "@spinjs/runtime";

export const toggle = defineComponent({
  name: "toggle",
  machine: (args) => toggleMachine(args),
  start: "off",
  parts: {
    root: {},
    trigger: {},
  },
  readers: {
    on: { read: (_context, state) => state === "on" },
    presses: { read: (context) => context.presses },
  },
  commands: {
    press: { event: () => ({ type: "PRESS" }) },
    reset: { event: () => ({ type: "RESET" }) },
  },
  events: {
    "press-change": {
      prop: "onPressChange",
      watch: (context) => [context.presses],
      detail: (watched) => ({ presses: watched[0] }),
    },
  },
});
```

## Platform controllers & DOM actions

When the browser already owns the state (such as native popover or tooltip triggers), use `defineController` from `@spinjs/runtime`. Reusable DOM behaviors (`anchor`, `drag`, `hover-delay`, `interact-outside`, `form-control`, `scroll-into-view`, `observe`) live in `@spinjs/runtime/actions`.

<!-- USER COPY SLOT: machines-close — your own patterns or migration guidance. -->
