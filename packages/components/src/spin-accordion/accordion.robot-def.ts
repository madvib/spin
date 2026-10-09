import type { MachineDef } from "@spin/runtime";
import { computed, machineTick, scope, signal } from "@spin/runtime";
import { createAccordionMachine, type AccordionRobotContext, type AccordionRobotService } from "./accordion.robot-machine.ts";
import { connectRobotAccordion, type RobotAccordionApi, type RobotConnectProps } from "./accordion.robot-connect.ts";

/**
 * The robot3 machine-def: the same `MachineDef` shape as the Zag one, so
 * the plugin's consume codegen is untouched — it calls
 * `createMachine(accordion.machine, { connect: accordion.connect, ... })`
 * either way.
 *
 * What differs is what `machine` and `connect` ARE. There is no Zag schema
 * here: `machine` is an opaque handle the bridge below closes over, and
 * `connect` is `(props, root, id) => api` — plain data in, plain data out.
 * The bridge reads scope values live (collapsible flips, callbacks arrive
 * as event-dispatching props from codegen), syncs them into robot context
 * before each send, and re-runs connect inside a `computed` so spreads
 * re-render on every transition. Disposal is the owner scope: no service
 * graph, no effects, nothing to tear down beyond the scope itself.
 */

export interface AccordionValueChange {
  readonly value: readonly string[];
}

/** Opaque handle: the adapter passes it through to `connect` untouched. */
const robotMachineHandle = { kind: "robot-accordion" } as const;

export interface RobotBridge {
  readonly api: RobotAccordionApi;
  dispose(): void;
}

export function createRobotBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): RobotBridge {
  const owner = scope();
  const tick = signal(0);

  let service: AccordionRobotService | undefined;

  const readProps = (): { ctx: Omit<AccordionRobotContext, "focusedValue">; connect: RobotConnectProps } => {
    const p = props();
    const seed = p["value"];
    return {
      ctx: {
        // Controlled seed: a `value` prop present at creation becomes the
        // initial open set, matching Zag's `value`/`defaultValue` bindable.
        // Updates after creation flow through VALUE.SET, never here.
        value: Array.isArray(seed) ? [...seed] : [],
        collapsible: p["collapsible"] !== false,
        multiple: p["multiple"] === true,
        onValueChange: p["onValueChange"] as ((details: { value: string[] }) => void) | undefined,
        onFocusChange: p["onFocusChange"] as ((details: { value: string | null }) => void) | undefined,
      },
      connect: {
        collapsible: p["collapsible"] !== false,
        disabled: p["disabled"] === true,
        orientation: p["orientation"] === "horizontal" ? "horizontal" : "vertical",
      },
    };
  };

  const ensureService = (): AccordionRobotService => {
    if (!service) {
      const { ctx } = readProps();
      service = owner.run(() => createAccordionMachine(ctx));
    }
    return service;
  };

  /** Sync scope props into context, then send: controlled props stay live. */
  const send = (event: { type: string } & Record<string, unknown>): void => {
    const svc = ensureService();
    const { ctx } = readProps();
    const live = svc.context as AccordionRobotContext;
    live.collapsible = ctx.collapsible;
    live.multiple = ctx.multiple;
    live.onValueChange = ctx.onValueChange;
    live.onFocusChange = ctx.onFocusChange;
    // Controlled `value`: a fresh array prop wins over machine state, so a
    // parent write takes effect on the next interaction without a remount.
    // Identity-compared — the machine's own transitions keep the same
    // reference, so only genuine parent writes re-seed.
    const outer = props()["value"];
    if (Array.isArray(outer) && outer !== live.value) live.value = [...outer];
    svc.send(event as never);
    tick(tick() + 1);
    // `bindSpread` subscribes to the shared tick, so a robot move must bump
    // it too — otherwise spreads render pre-transition props forever.
    machineTick(machineTick() + 1);
  };

  const connected = computed(() => {
    tick();
    const svc = ensureService();
    // `connect` closes over `ctx` at call time, so it must run against the
    // LIVE context object — never a snapshot. `service.context` is stable
    // across transitions (robot mutates it in place), so reading it inside
    // the computed keeps every getter on the latest value/focusedValue.
    const wrapped = { ...svc, send, context: svc.context };
    return connectRobotAccordion(wrapped as AccordionRobotService, readProps().connect, root(), id);
  });

  // The proxy keeps `values.accordion` stable while every read sees the
  // latest transition — the same live-view contract the Zag bridge offers.
  const api = new Proxy({} as RobotAccordionApi, {
    get: (_target, key) => Reflect.get(connected(), key),
    has: (_target, key) => Reflect.has(connected(), key),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return { api, dispose: () => owner.dispose() };
}

export const accordion: MachineDef = {
  machine: robotMachineHandle,
  connect: (() => {
    throw new Error("robot accordion connect runs through createRobotBridge, not the Zag adapter");
  }) as never,
  createBridge: createRobotBridge,
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: { value: string[] }): AccordionValueChange => ({
        value: change.value,
      }),
    },
  },
};
