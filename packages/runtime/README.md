# @spinjs/runtime

The reactive core everything interactive in Spin runs on: fine-grained
signals, the statechart interpreter, component synthesis, template directives,
and DOM actions. No workspace dependencies.

```sh
npm install @spinjs/runtime
```

```ts
import { computed, effect, signal } from "@spinjs/runtime";

const count = signal(0);
const doubled = computed(() => count() * 2);
effect(() => console.log("count:", count(), "doubled:", doubled()));
count(1); // logs count: 1 doubled: 2
```

```ts
import { createMachine, interpret } from "@spinjs/runtime/fsm";

const toggle = createMachine({
  initial: "off",
  context: { presses: 0 },
  states: {
    off: { on: { PRESS: { target: "on" } } },
    on: { on: { PRESS: { target: "off" } } },
  },
});
const actor = interpret(toggle);
actor.send({ type: "PRESS" });
```

## Subpaths

- `@spinjs/runtime` — signals, `defineComponent`, `defineController`,
  directives, and math.
- `@spinjs/runtime/fsm` — `createMachine` and `interpret`.
- `@spinjs/runtime/actions` — `createAction` plus the shipped element actions
  (`anchor`, `drag`, `hover-delay`, `interact-outside`, `form-control`,
  `scroll-into-view`, `observe`, and more).
- `@spinjs/runtime/props` — prop coercion helpers for machine input.
- `@spinjs/runtime/load` — the component loader compiled elements call.
- `@spinjs/runtime/testing` — test harnesses for machines and components.
