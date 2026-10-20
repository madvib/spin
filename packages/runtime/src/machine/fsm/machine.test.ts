import { assertEquals, assertThrows } from "@std/assert";
import { createMachine, interpret } from "./machine.ts";

/** Minimal config: internal transitions, guards, assigns, named impls. */
interface Ctx {
  readonly count: number;
  readonly label: string;
}

const machine = createMachine<Ctx, { type: "BUMP"; by: number } | { type: "LABEL"; text: string } | { type: "RESET" }>(
  {
    id: "test",
    initial: "idle",
    context: { count: 0, label: "start" },
    states: {
      idle: {
        exit: ["markExit"],
        on: {
          BUMP: [
            {
              cond: "isBig",
              target: "big",
              actions: [{ assign: "addBy" }],
            },
            { actions: [{ assign: "addBy" }] },
          ],
          LABEL: { actions: [{ assign: "setLabel" }, "recordLabel"] },
          RESET: { target: "idle" },
        },
      },
      big: {
        entry: ["markEntry"],
        on: {
          '*': [{ actions: [{ assign: "reset" }] }],
        },
      },
    },
    conds: {
      isBig: (ctx, event) => event.type === "BUMP" && ctx.count + (event as { by: number }).by >= 10,
    },
    assigns: {
      addBy: (_ctx, event) => ({ count: _ctx.count + (event as { by: number }).by }),
      setLabel: (_ctx, event) => ({ label: (event as { text: string }).text }),
      reset: () => ({ count: 0, label: "start" }),
    },
    actions: {
      markExit: (ctx) => {
        exited.push(ctx.label);
      },
      markEntry: (ctx) => {
        entered.push(ctx.count);
      },
      recordLabel: (ctx) => {
        recorded.push(ctx.label);
      },
    },
});

let exited: string[] = [];
let entered: number[] = [];
let recorded: string[] = [];

Deno.test("initial state applies entry actions and initial context", () => {
  const m = createMachine<Ctx, { type: "X" }>({
    initial: "idle",
    context: { count: 7, label: "seed" },
    states: { idle: { entry: ["recordLabel"] } },
    actions: { recordLabel: (ctx: Ctx) => recorded.push(ctx.label) },
  });
  recorded = [];
  assertEquals(m.initialState.value, "idle");
  assertEquals(m.initialState.context, { count: 7, label: "seed" });
  assertEquals(m.initialState.actions.length, 1);
  const svc = interpret(m).start();
  assertEquals(recorded, ["seed"]);
  svc.stop();
});

Deno.test("guarded transitions take the first passing candidate", () => {
  exited = [];
  const svc = interpret(machine).start();
  svc.send({ type: "BUMP", by: 4 });
  assertEquals(svc.state.value, "idle");
  assertEquals(svc.state.context.count, 4);
  svc.send({ type: "BUMP", by: 6 });
  assertEquals(svc.state.value, "big");
  assertEquals(svc.state.context.count, 10);
  svc.stop();
});

Deno.test("internal transition runs actions without changing state", () => {
  entered = [];
  recorded = [];
  const svc = interpret(machine).start();
  svc.send({ type: "LABEL", text: "hey" });
  assertEquals(svc.state.value, "idle");
  assertEquals(svc.state.context.label, "hey");
  // The side-effect action sees the folded context.
  assertEquals(recorded, ["hey"]);
  svc.stop();
});

Deno.test("actions collect exit -> transition -> entry in order", () => {
  exited = [];
  entered = [];
  const svc = interpret(machine).start();
  svc.send({ type: "BUMP", by: 20 });
  assertEquals(exited, ["start"]);
  assertEquals(entered, [20]);
  svc.stop();
});

Deno.test("wildcard handlers catch every event", () => {
  const svc = interpret(machine).start();
  svc.send({ type: "BUMP", by: 99 });
  assertEquals(svc.state.value, "big");
  svc.send({ type: "LABEL", text: "anything" });
  assertEquals(svc.state.context, { count: 0, label: "start" });
  svc.stop();
});

Deno.test("unknown cond or assign name throws with the name", () => {
  const m = createMachine<Ctx, { type: "GO" }>({
    initial: "a",
    context: { count: 0, label: "" },
    states: { a: { on: { GO: { target: "a", cond: "missing" } } } },
  });
  const svc = interpret(m);
  assertThrows(() => svc.send({ type: "GO" }), Error, "missing");
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
  const svc = interpret(createMachine<{ n: number }, { type: "BUMP" }>({
    initial: "bare",
    context: { n: 0 },
    on: { BUMP: { actions: [{ assign: "bump" }] } },
    states: { bare: {}, other: { on: { BUMP: { actions: [{ assign: "bump" }] } } } },
    assigns: { bump: (c: { n: number }) => ({ n: c.n + 1 }) },
  })).start();
  assertEquals(svc.state.value, "bare");
  svc.send({ type: "BUMP" });
  assertEquals(svc.state.context.n, 1);
  svc.send({ type: "BUMP" });
  assertEquals(svc.state.context.n, 2);
});
