import type { MachineDef } from "@spin/runtime";
import { computed, effect, machineTick, scope, signal } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import { connectRobotTabs, type TabsFsmApi, type TabsFsmConnectProps, type TreeNode } from "./tabs.fsm-connect.ts";
import { config, implementations, type TabsContext, type TabsEvent } from "./tabs.fsm-machine.ts";

/**
 * The tabs bridge. Same three jobs as every other: seed from default*,
 * sync the props the assigns read, publish the connect api through the
 * live-view proxy. Controlled `value` alternates only when authored
 * (BuildContext.authored), so a host write wins and the coerced default
 * never does.
 */

export interface TabsValueChange {
  readonly value: string | null;
}
export interface TabsFocusChange {
  readonly focusedValue: string | null;
}

function createTabsBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: TabsFsmApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<TabsContext, TabsEvent>(config, implementations);

  let service: FsmService<TabsContext, TabsEvent> | undefined;

  const rows = (): readonly TreeNode[] => {
    const raw = props()["items"];
    return Array.isArray(raw) ? (raw as TreeNode[]) : [];
  };

  const readProps = (): Pick<TabsContext, "activationMode" | "deselectable"> => {
    const p = props();
    return {
      activationMode: p["activationMode"] === "manual" ? "manual" : "automatic",
      deselectable: p["deselectable"] === true,
    };
  };

  const connectProps = (): TabsFsmConnectProps => {
    const p = props();
    return {
      orientation: p["orientation"] === "vertical" ? "vertical" : "horizontal",
      activationMode: p["activationMode"] === "manual" ? "manual" : "automatic",
      loopFocus: p["loopFocus"] !== false,
      deselectable: p["deselectable"] === true,
    };
  };

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const ensureService = (): FsmService<TabsContext, TabsEvent> => {
    if (!service) {
      const seeded = props()["defaultValue"];
      service = owner.run(() => interpret(machine).start());
      if (typeof seeded === "string" && seeded.length > 0) {
        service.state.context.value = seeded;
        service.state.context.focusedValue = seeded;
      }
    }
    return service;
  };

  /** Controlled alternates from an authored prop, immediately. */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      Object.assign(svc.state.context, readProps());
      const outer = props()["value"];
      if (authored("value") && (typeof outer === "string" || outer === null) && outer !== svc.state.context.value) {
        svc.state.context.value = outer as string | null;
        tick(tick() + 1);
        machineTick(machineTick() + 1);
      }
    }),
  );

  let lastValue: string | null | undefined;
  let lastFocused: string | null | undefined;
  const send = (event: TabsEvent): void => {
    const svc = ensureService();
    const before = { value: svc.state.context.value, focused: svc.state.context.focusedValue };
    svc.send(event);
    const after = svc.state.context;
    const cb = props();
    if (after.value !== before.value && lastValue !== after.value) {
      lastValue = after.value;
      (cb["onValueChange"] as ((d: TabsValueChange) => void) | undefined)?.({ value: after.value });
    }
    if (after.focusedValue !== before.focused && lastFocused !== after.focusedValue) {
      lastFocused = after.focusedValue;
      (cb["onFocusChange"] as ((d: TabsFocusChange) => void) | undefined)?.({ focusedValue: after.focusedValue });
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  const connected = computed(() => {
    tick();
    const svc = ensureService();
    const adapted = { send: send as (e: { type: string } & Record<string, unknown>) => void, get context() {
      return svc.state.context;
    } };
    return connectRobotTabs(
      adapted,
      connectProps(),
      rows(),
      _root(),
      send as (event: { type: string } & Record<string, unknown>) => void,
    );
  });

  // Commands resolve INSIDE the trap: Object.assign onto a live-view proxy
  // is shadowed by its own get trap and the host would call undefined.
  const commands = {
    select: (value: string | null): void => send({ type: "SET_VALUE", value }),
    focus: (value: string): void => send({ type: "TAB_FOCUS", value }),
    get value(): string | null {
      return ensureService().state.context.value;
    },
  };

  const api = new Proxy({} as TabsFsmApi, {
    get: (_target, key) =>
      key in commands
        ? (commands as Record<string | symbol, unknown>)[key]
        : Reflect.get(connected(), key),
    has: (_target, key) => key in commands || Reflect.has(connected(), key),
    ownKeys: () => [...Reflect.ownKeys(connected()), ...Object.keys(commands)],
    getOwnPropertyDescriptor: (_target, key) => {
      if (key in commands) {
        return { configurable: true, enumerable: true, value: (commands as Record<string | symbol, unknown>)[key] };
      }
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return {
    api: api as TabsFsmApi,
    dispose: () => {
      service?.stop();
      owner.dispose();
    },
  };
}

export const tabs: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("tabs fsm runs through createTabsBridge");
  }) as never,
  createBridge: createTabsBridge,
  commands: ["select", "focus"],
  events: {
    "value-change": { on: "onValueChange", detail: (c: TabsValueChange) => ({ value: c.value }) },
    "focus-change": { on: "onFocusChange", detail: (c: TabsFocusChange) => ({ focusedValue: c.focusedValue }) },
  },
};
