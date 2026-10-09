import type { MachineDef } from "@spin/runtime";
import { computed, machineTick, scope, signal } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import { connectRobotAccordion, type RobotAccordionApi, type RobotConnectProps } from "./accordion.robot-connect.ts";
import type { AccordionRobotContext } from "./accordion.robot-machine.ts";

/**
 * The accordion on the forked FSM: config as data, the same connect.
 *
 * This is the third implementation behind one machine-def contract, and it
 * exists to prove two things at once:
 *
 * 1. **The connect layer is interpreter-agnostic.** `connectRobotAccordion`
 * runs unmodified against a robot3 service and against this fork, because
 * both present `{ send, context }`. The adapter below is the whole cost of
 * supporting a new interpreter: map context, wrap send.
 * 2. **Config-first authoring is viable.** States, guards, and context
 * writes are plain data (`{ cond: "canCollapse" }`, `{ assign: "collapse" }`),
 * with named conds/assigns as pure functions in the implementations table.
 * Nothing in the config closes over anything — visualizable, diffable, and
 * authorable by an agent without reading interpreter internals.
 *
 * The DOM contract, `value-change` event, and markup are identical to the
 * Zag and robot paths.
 */

export interface AccordionValueChange {
  readonly value: readonly string[];
}

interface AccordionContext extends AccordionRobotContext {
  /** Previous emitted value, so an equal VALUE.SET doesn't re-fire. */
  prev: string[];
}

type AccordionEvent =
  | { type: "TRIGGER.CLICK"; value: string }
  | { type: "TRIGGER.FOCUS"; value: string }
  | { type: "TRIGGER.BLUR" }
  | { type: "VALUE.SET"; value: string[] }
  | { type: "FOCUS.SET"; value: string | null };

const sameArray = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const config = {
  id: "accordion",
  initial: "idle",
  context: {
    value: [] as string[],
    focusedValue: null as string | null,
    collapsible: true,
    multiple: false,
    prev: [] as string[],
    onValueChange: undefined as ((details: { value: string[] }) => void) | undefined,
    onFocusChange: undefined as ((details: { value: string | null }) => void) | undefined,
  },
  states: {
    idle: {
      on: {
        "TRIGGER.FOCUS": { target: "focused", actions: [{ assign: "setFocused" as const }] },
        "TRIGGER.CLICK": [
          { cond: "canCollapse" as const, actions: [{ assign: "collapse" as const }, "emitValue" as const] },
          { cond: "canExpand" as const, actions: [{ assign: "expand" as const }, "emitValue" as const] },
        ],
        "VALUE.SET": { actions: [{ assign: "setValue" as const }, "emitValue" as const] },
        "FOCUS.SET": { actions: [{ assign: "setFocused" as const }] },
      },
    },
    focused: {
      on: {
        "TRIGGER.CLICK": [
          { cond: "canCollapse" as const, actions: [{ assign: "collapse" as const }, "emitValue" as const] },
          { cond: "canExpand" as const, actions: [{ assign: "expand" as const }, "emitValue" as const] },
        ],
        "TRIGGER.BLUR": { target: "idle", actions: [{ assign: "clearFocused" as const }] },
        "VALUE.SET": { actions: [{ assign: "setValue" as const }, "emitValue" as const] },
        "FOCUS.SET": { actions: [{ assign: "setFocused" as const }] },
      },
    },
  },
};

/** Named conds and assigns — pure, reviewable, the config's whole vocabulary. */
const implementations = {
  conds: {
    canCollapse: (ctx: AccordionContext, event: AccordionEvent) =>
      event.type === "TRIGGER.CLICK" &&
      ctx.value.includes(event.value) &&
      (ctx.collapsible || ctx.multiple),
    canExpand: (ctx: AccordionContext, event: AccordionEvent) =>
      event.type === "TRIGGER.CLICK" && !ctx.value.includes(event.value),
  },
  assigns: {
    setFocused: (_ctx: AccordionContext, event: AccordionEvent) =>
      event.type === "TRIGGER.FOCUS" || event.type === "FOCUS.SET"
        ? { focusedValue: event.value }
        : {},
    clearFocused: () => ({ focusedValue: null }),
    setValue: (ctx: AccordionContext, event: AccordionEvent) =>
      event.type === "VALUE.SET" && !sameArray(ctx.value, event.value)
        ? { value: [...event.value], prev: ctx.value }
        : {},
    collapse: (_ctx: AccordionContext, event: AccordionEvent) => {
      const value = event.type === "TRIGGER.CLICK" ? event.value : "";
      return { value: _ctx.multiple ? _ctx.value.filter((v) => v !== value) : [], prev: _ctx.value };
    },
    expand: (_ctx: AccordionContext, event: AccordionEvent) => {
      const value = event.type === "TRIGGER.CLICK" ? event.value : "";
      return { value: _ctx.multiple ? [..._ctx.value, value] : [value], prev: _ctx.value };
    },
  },
  actions: {
    emitValue: (ctx: AccordionContext) => {
      if (sameArray(ctx.prev, ctx.value)) return;
      ctx.prev = ctx.value;
      ctx.onValueChange?.({ value: ctx.value });
    },
  },
};

export function createFsmBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: RobotAccordionApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);

  // Only the non-state fields sync per send. `value` is machine state; the
  // scope's `value` prop is a CONTROLLED seed/override, applied by identity
  // exactly as the robot bridge does — never a per-send overwrite, or
  // `canCollapse` could never observe an expanded item.
  const readSync = () => {
    const p = props();
    return {
      collapsible: p["collapsible"] !== false,
      multiple: p["multiple"] === true,
      onValueChange: p["onValueChange"] as ((details: { value: string[] }) => void) | undefined,
      onFocusChange: p["onFocusChange"] as ((details: { value: string | null }) => void) | undefined,
    };
  };

  const connectProps = (p: Record<string, unknown>): RobotConnectProps => ({
    collapsible: p["collapsible"] !== false,
    disabled: p["disabled"] === true,
    orientation: p["orientation"] === "horizontal" ? "horizontal" : "vertical",
  });

  const machine = createMachine<AccordionContext, AccordionEvent>(config, implementations);

  let service: FsmService<AccordionContext, AccordionEvent> | undefined;

  const ensureService = (): FsmService<AccordionContext, AccordionEvent> => {
    if (!service) {
      const ctx = { ...machine.initialState.context, ...readSync(), prev: [] };
      const seed = props()["value"];
      if (Array.isArray(seed)) ctx.value = [...(seed as string[])];
      service = owner.run(() => {
        const svc = interpret(machine).start();
        // Seed the initial context through the real service so `initialState`
        // computations (none yet, but the contract) stay upstream.
        svc.send({ type: "FOCUS.SET", value: null });
        return svc;
      });
      Object.assign(service.state.context, ctx);
    }
    return service;
  };

  /** Sync scope props into the live context, then send — controlled stays live. */
  const send = (event: { type: string } & Record<string, unknown>): void => {
    const svc = ensureService();
    Object.assign(svc.state.context, readSync());
    const outer = props()["value"];
    if (Array.isArray(outer) && outer !== svc.state.context.value) {
      svc.state.context.value = [...outer];
    }
    svc.send(event as AccordionEvent);
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  const connected = computed(() => {
    tick();
    const svc = ensureService();
    // The adapter: `context` is a getter over the latest folded state so the
    // shared connect reads live values, exactly as it does for robot3.
    const adapted = { send, get context() {
      return svc.state.context;
    } };
    return connectRobotAccordion(adapted as never, connectProps(props()), root(), id);
  });

  const api = new Proxy({} as RobotAccordionApi, {
    get: (_target, key) => Reflect.get(connected(), key),
    has: (_target, key) => Reflect.has(connected(), key),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return { api, dispose: () => {
    service?.stop();
    owner.dispose();
  } };
}

export const accordion: MachineDef = {
  machine: config,
  connect: (() => {
    throw new Error("fsm accordion runs through createFsmBridge");
  }) as never,
  createBridge: createFsmBridge,
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: { value: string[] }): AccordionValueChange => ({
        value: change.value,
      }),
    },
  },
};
