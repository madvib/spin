import { assertEquals } from "@std/assert";
import { assign, defineMachine, guard } from "./define.ts";
import { createMachine, interpret } from "@spin/runtime/fsm";

interface Counter {
  count: number;
  label: string;
}

type CounterEvent =
  | { type: "BUMP"; by: number }
  | { type: "LABEL"; text: string }
  | { type: "RESET" };

/** A machine written the way a component author writes one. */
const counter = defineMachine<Counter, CounterEvent>({
  id: "counter",
  initial: "idle",
  context: { count: 0, label: "start" },
  states: {
    idle: {
      on: {
        BUMP: [
          { cond: "isBig", target: "big", actions: [{ assign: "addBy" }] },
          { actions: [{ assign: "addBy" }] },
        ],
        LABEL: { actions: [{ assign: "setLabel" }] },
        RESET: { target: "idle" },
      },
    },
    big: {
      on: { RESET: { target: "idle", actions: [{ assign: "reset" }] } },
    },
  },
  conds: {
    isBig: guard("BUMP", (ctx, event) => ctx.count + event.by > 10),
  },
  assigns: {
    // The event arrives narrowed: no `if (event.type !== ...)` dance.
    addBy: assign("BUMP", (ctx, event) => ({ count: ctx.count + event.by })),
    setLabel: assign("LABEL", (_ctx, event) => ({ label: event.text })),
    reset: assign((ctx) => ({ count: 0 })),
  },
});

Deno.test("a defined machine runs its transitions", () => {
  const machine = createMachine<Counter, CounterEvent>(counter.config, counter.implementations);
  const service = interpret(machine).start();
  service.send({ type: "BUMP", by: 3 });
  assertEquals(service.state.context.count, 3);
  assertEquals(service.state.context.label, "start");
});

Deno.test("a defined machine's guard sees its event", () => {
  const machine = createMachine<Counter, CounterEvent>(counter.config, counter.implementations);
  const service = interpret(machine).start();
  service.send({ type: "BUMP", by: 20 });
  assertEquals(service.state.value, "big");
  service.send({ type: "RESET" });
  assertEquals(service.state.value, "idle");
  assertEquals(service.state.context.count, 0);
});

Deno.test("a defined machine's assign sees its event", () => {
  const machine = createMachine<Counter, CounterEvent>(counter.config, counter.implementations);
  const service = interpret(machine).start();
  service.send({ type: "LABEL", text: "hi" });
  assertEquals(service.state.context.label, "hi");
});

Deno.test("a machine's context is its own default, not a prop's", () => {
  assertEquals(counter.config.context?.count, 0);
  assertEquals(counter.config.context?.label, "start");
});
