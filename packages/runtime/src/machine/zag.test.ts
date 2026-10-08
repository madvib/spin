import { assertEquals } from "@std/assert";
import { connect as accordionConnect, machine as accordionMachine } from "@zag-js/accordion";
import { createMachine } from "./adapter/index.ts";
import { effect, scope, signal } from "../core/signal.ts";

/**
 * These tests exist for one reason.
 *
 * `connect` closes over the machine's context at the moment it runs. Read once
 * at connect time, `api.value` is the value that was true then, forever. Every
 * assertion below is about a field being read again after the machine moved, and
 * a field read again with no movement returning the same thing — the two halves
 * of "live" that a stale snapshot fails in opposite directions.
 */

/** Zag defers every event to a microtask; the machine moves after this. */
const settle = () => new Promise<void>((resolve) => queueMicrotask(() => resolve()));

function accordion(owner: ReturnType<typeof scope>) {
  return owner.run(() =>
    createMachine(accordionMachine, { connect: accordionConnect, scope: owner })
  );
}

Deno.test("a field read through the bridge changes after a transition", async () => {
  const owner = scope();
  const machine = accordion(owner);

  assertEquals(machine.api.value, []);

  machine.api.setValue(["overview"]);
  await settle();

  assertEquals(machine.api.value, ["overview"]);
});

Deno.test("a field the bridge holds onto still tracks the machine", async () => {
  const owner = scope();
  // The exact shape of the bug: capture the API once, keep it, read it much
  // later. A snapshot cannot survive this; a proxy over a computed can.
  const { api } = accordion(owner);

  api.setValue(["advanced"]);
  await settle();

  assertEquals(api.value, ["advanced"]);
});

Deno.test("an api taken apart still drives the machine", async () => {
  const owner = scope();
  const machine = accordion(owner);

  // Spreading goes through `ownKeys`, `getOwnPropertyDescriptor` and `get` on
  // the proxy, and every one of them has to agree or the spread is a lie.
  const { setValue } = { ...machine.api };

  setValue(["spread"]);
  await settle();

  assertEquals(machine.api.value, ["spread"]);
  // Reading the item state through the bridge, not through a copy taken before
  // the move: a function destructured off the api closes over the snapshot
  // `connect` produced, which is Zag's own behaviour and the reason fields are
  // read, never captured.
  assertEquals(machine.api.getItemState({ value: "spread" }).expanded, true);
});

Deno.test("a multi-value machine reports every expanded item", async () => {
  const owner = scope();
  const machine = owner.run(() =>
    createMachine(accordionMachine, {
      connect: accordionConnect,
      scope: owner,
      props: { multiple: true },
    })
  );

  machine.api.setValue(["api", "advanced"]);
  await settle();

  assertEquals(machine.api.value, ["api", "advanced"]);
});

Deno.test("a field read inside an effect re-runs when the machine moves", async () => {
  const owner = scope();
  const machine = accordion(owner);
  let runs = 0;
  let seen: string[] = [];

  owner.run(() => {
    effect(() => {
      runs++;
      seen = machine.api.value;
    });
  });

  assertEquals([runs, seen], [1, []]);

  machine.api.setValue(["details"]);
  await settle();

  assertEquals([runs, seen], [2, ["details"]]);
});

Deno.test("reading a field with no machine movement does not re-run its effect", async () => {
  const owner = scope();
  const machine = accordion(owner);
  let runs = 0;

  owner.run(() => {
    effect(() => {
      machine.api.value;
      runs++;
    });
  });

  machine.api.setValue(["only-once"]);
  await settle();

  assertEquals(runs, 2);
});

Deno.test("a function read through the bridge drives the machine it came from", async () => {
  const owner = scope();
  const machine = accordion(owner);

  const setValue = machine.api.setValue;
  assertEquals(typeof setValue, "function");

  setValue(["chosen"]);
  await settle();

  assertEquals(machine.api.value, ["chosen"]);
});

Deno.test("the machine's state is a signal a template can read", async () => {
  const owner = scope();
  const machine = accordion(owner);
  const states: string[] = [];

  owner.run(() => {
    effect(() => {
      states.push(machine.state());
    });
  });

  machine.send({ type: "TRIGGER.FOCUS", value: "one" });
  await settle();

  assertEquals(states, ["idle", "focused"]);
});

Deno.test("a machine's computed value follows its context", () => {
  const owner = scope();
  const machine = owner.run(() =>
    createMachine(accordionMachine, {
      connect: accordionConnect,
      scope: owner,
      props: { orientation: "horizontal" },
    })
  );

  assertEquals(machine.computed("isHorizontal"), true);
  assertEquals(machine.state(), "idle");
});

Deno.test("a disposed scope stops the machine before its events land", async () => {
  const owner = scope();
  const machine = accordion(owner);

  assertEquals(machine.service.getStatus(), "Started");

  owner.dispose();
  machine.api.setValue(["after-dispose"]);
  await settle();

  assertEquals(machine.service.getStatus(), "Stopped");
  assertEquals(machine.api.value, []);
});

Deno.test("a controlled prop moves the machine from outside it", async () => {
  const owner = scope();
  // A signal, not a plain object: the machine re-reads its props through a
  // computed, and a computed only moves when something it read is reactive.
  const controlled = signal<string[]>(["from-owner"]);
  const machine = owner.run(() =>
    createMachine(accordionMachine, {
      connect: accordionConnect,
      scope: owner,
      props: () => ({ value: controlled(), multiple: true }),
    })
  );

  assertEquals(machine.api.value, ["from-owner"]);

  controlled(["moved"]);
  assertEquals(machine.api.value, ["moved"]);

  // The machine's own write is refused while it is controlled, which is what
  // makes a controlled prop controlled rather than merely initial.
  machine.api.setValue(["ignored"]);
  await settle();

  assertEquals(machine.api.value, ["moved"]);
});