import { assertEquals } from "@std/assert";
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

Deno.test("the initial state is the spec's context", () => {
  const m = createMachine<Ctx, Events>({
    initial: "idle",
    context: { count: 7, label: "seed" },
    states: { idle: {} },
  });
  assertEquals(m.initialState.value, "idle");
  assertEquals(m.initialState.context, { count: 7, label: "seed" });
});

Deno.test("guarded transitions take the first passing candidate", () => {
  const svc = interpret(machine).start();
  svc.send({ type: "BUMP", by: 4 });
  assertEquals(svc.state.value, "idle");
  assertEquals(svc.state.context.count, 4);
  svc.send({ type: "BUMP", by: 6 });
  assertEquals(svc.state.value, "big");
  assertEquals(svc.state.context.count, 10);
  svc.stop();
});

Deno.test("an internal transition writes the context without changing state", () => {
  const svc = interpret(machine).start();
  svc.send({ type: "LABEL", text: "hey" });
  assertEquals(svc.state.value, "idle");
  assertEquals(svc.state.context.label, "hey");
  svc.stop();
});

Deno.test("a transition's writes see what the last one wrote", () => {
  const svc = interpret(machine).start();
  svc.send({ type: "BUMP", by: 20 });
  assertEquals(svc.state.value, "big");
  assertEquals(svc.state.context.count, 20);
  svc.stop();
});

Deno.test("a state's entry writes land after the transition's", () => {
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
  assertEquals(svc.state.context, { count: 3, label: "at 3" });
  svc.stop();
});

Deno.test("send after stop is inert", () => {
  const svc = interpret(machine).start();
  svc.stop();
  const before = svc.state;
  svc.send({ type: "BUMP", by: 5 });
  assertEquals(svc.state, before);
});

Deno.test("transition from a bare state name starts from initial context", () => {
  const s = machine.transition("idle", { type: "BUMP", by: 3 });
  assertEquals(s.value, "idle");
  assertEquals(s.context.count, 3);
});

Deno.test("root handlers reach states that declare no on", () => {
  const svc = interpret(createMachine<{ n: number }, { BUMP: {} }>({
    initial: "bare",
    context: { n: 0 },
    on: { BUMP: { assign: (c) => ({ n: c.n + 1 }) } },
    states: {
      bare: {},
      other: { on: { BUMP: { assign: (c) => ({ n: c.n + 1 }) } } },
    },
  })).start();
  assertEquals(svc.state.value, "bare");
  svc.send({ type: "BUMP" });
  assertEquals(svc.state.context.n, 1);
  svc.send({ type: "BUMP" });
  assertEquals(svc.state.context.n, 2);
});
