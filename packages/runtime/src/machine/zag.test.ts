import { assertEquals } from "@std/assert";
import { createMachine } from "./adapter/index.ts";
import { effect, scope, signal } from "../core/signal.ts";

/**
 * These tests exist for one reason.
 *
 * `connect` closes over the machine's context at the moment it runs. Read once
 * at connect time, `api.value` is the value that was true then, forever. Every
 * assertion below is about a field being read again after the machine moved,
 * and a field read again with no movement returning the same thing — the two
 * halves of "live" that a stale snapshot fails in opposite directions.
 *
 * The machine below is a zag-SHAPED fixture, written here rather than
 * imported: the runtime must never depend on zag (the seam is the whole
 * point), and a third-party boundary is exactly where a structural stand-in
 * belongs. It mirrors @zag-js/accordion's config surface — props, bindables,
 * states, computed, implementations — so the adapter under test sees the
 * real contract.
 */

/** Zag defers every event to a microtask; the machine moves after this. */
const settle = () => new Promise<void>((resolve) => queueMicrotask(() => resolve()));

interface TestContext {
  value: string[];
  focusedValue: string | null;
}

type TestEvent =
  | { type: "VALUE.SET"; value: string[] }
  | { type: "TRIGGER.FOCUS"; value: string }
  | { type: "TRIGGER.BLUR" };

/** The bindable contract the adapter provides to `context`. */
interface TestBindable<T> {
  get(): T;
  set(next: T): void;
  initial: T;
  hash(value: T): string;
  invoke(current: T, next: T): void;
}

const fixtureMachine = {
  props: ({ props }: { props: Record<string, unknown> }): Record<string, unknown> => ({
    multiple: false,
    orientation: "vertical",
    ...props,
  }),
  initialState: (): string => "idle",
  context: ({ prop, bindable }: {
    prop: (key: string) => unknown;
    bindable: <T>(fn: () => {
      defaultValue: T;
      value?: T | undefined;
      onChange?: (value: T) => void;
      sync?: boolean;
      isEqual?: (a: T, b: T) => boolean;
    }) => TestBindable<T>;
  }) => ({
    value: bindable<string[]>(() => ({
      defaultValue: [],
      value: prop("value") as string[] | undefined,
      onChange(next) {
        const notify = prop("onValueChange") as ((details: { value: string[] }) => void) | undefined;
        notify?.({ value: next });
      },
    })),
    focusedValue: bindable<string | null>(() => ({
      defaultValue: null,
      sync: true,
      onChange(next) {
        const notify = prop("onFocusChange") as ((details: { value: string | null }) => void) | undefined;
        notify?.({ value: next });
      },
    })),
  }),
  computed: {
    isHorizontal: ({ prop }: { prop: (key: string) => unknown }): boolean =>
      prop("orientation") === "horizontal",
  },
  on: {
    "VALUE.SET": { actions: ["setValue"] },
  },
  states: {
    idle: {
      on: {
        "TRIGGER.FOCUS": { target: "focused", actions: ["setFocusedValue"] },
      },
    },
    focused: {
      on: {
        "TRIGGER.BLUR": { target: "idle", actions: ["clearFocusedValue"] },
      },
    },
  },
  implementations: {
    actions: {
      setValue: ({ context, event }: { context: { set: (k: string, v: unknown) => void }; event: TestEvent }) => {
        if (event.type === "VALUE.SET") context.set("value", event.value);
      },
      setFocusedValue: ({ context, event }: { context: { set: (k: string, v: unknown) => void }; event: TestEvent }) => {
        if (event.type === "TRIGGER.FOCUS") context.set("focusedValue", event.value);
      },
      clearFocusedValue: ({ context }: { context: { set: (key: string, value: unknown) => void } }) => {
        context.set("focusedValue", null);
      },
    },
  },
};

interface TestApi {
  readonly value: string[];
  readonly focusedValue: string | null;
  setValue(value: string[]): void;
  getItemState(props: { value: string }): { expanded: boolean; focused: boolean };
}

const fixtureConnect = (service: {
  context: { get: (key: string) => unknown };
  send: (event: unknown) => void;
  prop: (key: string) => unknown;
}): TestApi => ({
  value: service.context.get("value") as string[],
  focusedValue: service.context.get("focusedValue") as string | null,
  setValue: (value: string[]) => service.send({ type: "VALUE.SET", value }),
  getItemState: (props) => ({
    expanded: (service.context.get("value") as string[]).includes(props.value),
    focused: service.context.get("focusedValue") === props.value,
  }),
});

/** A props channel that is either a snapshot or a live getter. */
type TestProps = Record<string, unknown> | (() => Record<string, unknown>);

function fixture(owner: ReturnType<typeof scope>, props?: TestProps) {
  return owner.run(() =>
    createMachine(fixtureMachine as never, {
      connect: fixtureConnect as never,
      props: props as never,
      scope: owner,
    }),
  ) as unknown as {
    api: TestApi;
    state: () => string;
    computed: (key: string) => unknown;
    send: (event: TestEvent) => void;
    service: { getStatus: () => string };
    dispose: () => void;
  };
}

Deno.test("a field read through the bridge changes after a transition", async () => {
  const owner = scope();
  const machine = fixture(owner);

  assertEquals(machine.api.value, []);

  machine.api.setValue(["overview"]);
  await settle();

  assertEquals(machine.api.value, ["overview"]);
});

Deno.test("a field the bridge holds onto still tracks the machine", async () => {
  const owner = scope();
  // The exact shape of the bug: capture the API once, keep it, read it much
  // later. A snapshot cannot survive this; a proxy over a computed can.
  const { api } = fixture(owner);

  api.setValue(["advanced"]);
  await settle();

  assertEquals(api.value, ["advanced"]);
});

Deno.test("an api taken apart still drives the machine", async () => {
  const owner = scope();
  const machine = fixture(owner);

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
  const machine = fixture(owner, { multiple: true });

  machine.api.setValue(["api", "advanced"]);
  await settle();

  assertEquals(machine.api.value, ["api", "advanced"]);
});

Deno.test("a field read inside an effect re-runs when the machine moves", async () => {
  const owner = scope();
  const machine = fixture(owner);
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
  const machine = fixture(owner);
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
  const machine = fixture(owner);

  const setValue = machine.api.setValue;
  assertEquals(typeof setValue, "function");

  setValue(["chosen"]);
  await settle();

  assertEquals(machine.api.value, ["chosen"]);
});

Deno.test("the machine's state is a signal a template can read", async () => {
  const owner = scope();
  const machine = fixture(owner);
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

Deno.test("a machine's computed value follows its props", () => {
  const owner = scope();
  const machine = fixture(owner, { orientation: "horizontal" });

  assertEquals(machine.computed("isHorizontal"), true);
  assertEquals(machine.state(), "idle");
});

Deno.test("a disposed scope stops the machine before its events land", async () => {
  const owner = scope();
  const machine = fixture(owner);

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
  const machine = fixture(owner, () => ({ value: controlled(), multiple: true }));

  assertEquals(machine.api.value, ["from-owner"]);

  controlled(["moved"]);
  assertEquals(machine.api.value, ["moved"]);

  // The machine's own write is refused while it is controlled, which is what
  // makes a controlled prop controlled rather than merely initial.
  machine.api.setValue(["ignored"]);
  await settle();

  assertEquals(machine.api.value, ["moved"]);
});
