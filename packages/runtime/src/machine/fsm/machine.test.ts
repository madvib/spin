import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { createMachine, interpret } from "./machine.ts";

/** The machine's events, as a MAP: the contract with the outside. */
interface Events {
  BUMP: { by: number };
  LABEL: { text: string };
  RESET: {};
}

interface Ctx {
  readonly count: number;
  readonly label: string;
}

/**
 * The machine, in the authoring API: the `on` map's KEY narrows the event,
 * so the assign reads its payload with no guard and no cast.
 */
const machine = createMachine<Ctx, Events>({
  id: "test",
  initial: "idle",
  context: { count: 0, label: "start" },
  states: {
    idle: {
      on: {
        BUMP: [
          {
            cond: (ctx, event) => ctx.count + event.by >= 10,
            target: "big",
            assign: (ctx, event) => ({ count: ctx.count + event.by }),
          },
          { assign: (ctx, event) => ({ count: ctx.count + event.by }) },
        ],
        LABEL: { assign: (_ctx, event) => ({ label: event.text }) },
        RESET: { target: "idle" },
      },
    },
    big: {
      on: {
        RESET: { assign: () => ({ count: 0, label: "start" }) },
      },
    },
  },
});

test("the initial state is the spec's context", () => {
  const m = createMachine<Ctx, Events>({
    initial: "idle",
    context: { count: 7, label: "seed" },
    states: { idle: {} },
  });
  deepStrictEqual(m.initialState.value, "idle");
  deepStrictEqual(m.initialState.context, { count: 7, label: "seed" });
});

test("guarded transitions take the first passing candidate", () => {
  const svc = interpret(machine).start();
  svc.send({ type: "BUMP", by: 4 });
  deepStrictEqual(svc.state.value, "idle");
  deepStrictEqual(svc.state.context.count, 4);
  svc.send({ type: "BUMP", by: 6 });
  deepStrictEqual(svc.state.value, "big");
  deepStrictEqual(svc.state.context.count, 10);
  svc.stop();
});

test("an internal transition writes the context without changing state", () => {
  const svc = interpret(machine).start();
  svc.send({ type: "LABEL", text: "hey" });
  deepStrictEqual(svc.state.value, "idle");
  deepStrictEqual(svc.state.context.label, "hey");
  svc.stop();
});

test("a transition's writes see what the last one wrote", () => {
  const svc = interpret(machine).start();
  svc.send({ type: "BUMP", by: 20 });
  deepStrictEqual(svc.state.value, "big");
  deepStrictEqual(svc.state.context.count, 20);
  svc.stop();
});

test("a state's entry writes land after the transition's", () => {
  const svc = interpret(createMachine<Ctx, Events>({
    initial: "idle",
    context: { count: 0, label: "start" },
    states: {
      idle: {
        on: {
          BUMP: {
            target: "big",
            assign: (ctx, event) => ({ count: ctx.count + event.by }),
          },
        },
      },
      big: { entry: [(ctx) => ({ label: `at ${ctx.count}` })] },
    },
  })).start();
  svc.send({ type: "BUMP", by: 3 });
  deepStrictEqual(svc.state.context, { count: 3, label: "at 3" });
  svc.stop();
});

test("send after stop is inert", () => {
  const svc = interpret(machine).start();
  svc.stop();
  const before = svc.state;
  svc.send({ type: "BUMP", by: 5 });
  deepStrictEqual(svc.state, before);
});

test("transition from a bare state name starts from initial context", () => {
  const s = machine.transition("idle", { type: "BUMP", by: 3 });
  deepStrictEqual(s.value, "idle");
  deepStrictEqual(s.context.count, 3);
});

test("root handlers reach states that declare no on", () => {
  const svc = interpret(createMachine<{ n: number }, { BUMP: {} }>({
    initial: "bare",
    context: { n: 0 },
    on: { BUMP: { assign: (c) => ({ n: c.n + 1 }) } },
    states: {
      bare: {},
      other: { on: { BUMP: { assign: (c) => ({ n: c.n + 1 }) } } },
    },
  })).start();
  deepStrictEqual(svc.state.value, "bare");
  svc.send({ type: "BUMP" });
  deepStrictEqual(svc.state.context.n, 1);
  svc.send({ type: "BUMP" });
  deepStrictEqual(svc.state.context.n, 2);
});
