import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  connectRobotNavigationMenu,
  type NavItemRecord,
  type NavigationMenuApi,
  type NavigationMenuConnectProps,
} from "./navigation-menu.connect.ts";
import {
  config,
  implementations,
  type NavigationMenuContext,
  type NavigationMenuEvent,
  type NavigationMenuValueChange,
} from "./navigation-menu.machine.ts";

export type { NavItemRecord, NavigationMenuValueChange };

/** An authored-prop predicate: a coerced default is never a host write. */
const authored = (props: () => Record<string, unknown>, name: string): boolean => {
  const predicate = props()["@@authored"];
  return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
};

/** The JSON transport for the item collection. */
const parseItems = (raw: unknown): NavItemRecord[] | null => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const items: NavItemRecord[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const bag = entry as Record<string, unknown>;
    const value = bag["value"];
    const label = bag["label"];
    if (typeof value !== "string" || typeof label !== "string") continue;
    items.push({ value, label });
  }
  return items;
};

/**
 * The navigation-menu bridge: scope values in, machine state out.
 *
 * Four jobs. Seed the first state from the authored `value` (or
 * `defaultValue`), alternate the controlled `value`, sync the scalars the
 * assigns read (the two delays, orientation, disabled), and publish the
 * connect api through the live-view proxy. The change callback fires
 * from one funnel after every send.
 */
export function createNavigationMenuBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: NavigationMenuApi; dispose(): void } {
  void root;
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<NavigationMenuContext, NavigationMenuEvent>(config, implementations);

  let service: Service<NavigationMenuContext, NavigationMenuEvent> | undefined;

  const ensureService = (): Service<NavigationMenuContext, NavigationMenuEvent> => {
    if (service !== undefined) return service;
    const p = props();
    service = owner.run(() => {
      const svc = interpret(machine).start();
      // A send first: the fork's initial context is the config's object
      // until a transition folds a copy, and two menus on a page would
      // otherwise share one context until the first hover.
      svc.send({ type: "VALUE.SET", value: "" });
      svc.state.context.openDelay = typeof p["openDelay"] === "number" ? p["openDelay"] : 200;
      svc.state.context.closeDelay = typeof p["closeDelay"] === "number" ? p["closeDelay"] : 300;
      svc.state.context.orientation = p["orientation"] === "vertical" ? "vertical" : "horizontal";
      svc.state.context.disabled = p["disabled"] === true;
      const seeded = authored(props, "value") ? p["value"] : p["defaultValue"];
      if (typeof seeded === "string" && seeded.length > 0) {
        svc.send({ type: "VALUE.SET", value: seeded });
        if (seeded.length > 0) svc.send({ type: "ITEM.TOGGLE", value: seeded });
      }
      return svc;
    });
    return service;
  };

  const readConnectProps = (): NavigationMenuConnectProps => {
    const p = props();
    return {
      items: parseItems(p["items"]) ?? [],
      orientation: p["orientation"] === "vertical" ? "vertical" : "horizontal",
      disabled: p["disabled"] === true,
    };
  };

  function send(event: NavigationMenuEvent): void {
    const svc = ensureService();
    const before = `${svc.state.context.value}|${svc.state.context.previousValue}`;
    svc.send(event);
    const after = svc.state.context;
    if (`${after.value}|${after.previousValue}` !== before) {
      (props()["onValueChange"] as ((d: NavigationMenuValueChange) => void) | undefined)?.({
        value: after.value,
        previousValue: after.previousValue,
      });
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  }

  ensureService();

  /** One connect per element, not one per machine move. */
  let navConnect: NavigationMenuApi | undefined;
  const ensureConnect = (): NavigationMenuApi => {
    navConnect ??= connectRobotNavigationMenu(
      {
        send,
        get context(): NavigationMenuContext {
          return ensureService().state.context;
        },
        get isOpen(): boolean {
          return ensureService().state.value === "open";
        },
      },
      readConnectProps,
      id,
    );
    return navConnect;
  };

  /** The last authored open value, for the change-guarded channel. */
  let lastAuthored: string | undefined = undefined;

  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const p = props();
      svc.state.context.openDelay = typeof p["openDelay"] === "number" ? p["openDelay"] : 200;
      svc.state.context.closeDelay = typeof p["closeDelay"] === "number" ? p["closeDelay"] : 300;
      svc.state.context.orientation = p["orientation"] === "vertical" ? "vertical" : "horizontal";
      svc.state.context.disabled = p["disabled"] === true;
      if (authored(props, "value")) {
        const outer = p["value"];
        if (typeof outer === "string" && lastAuthored !== outer) {
          lastAuthored = outer;
          untrack(() => send({ type: "VALUE.SET", value: outer }));
          const want = outer.length > 0;
          const have = svc.state.value === "open";
          if (want !== have) untrack(() => send({ type: "ITEM.TOGGLE", value: outer }));
        }
      }
    }),
  );

  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as NavigationMenuApi, {
    get: (_target, key) => Reflect.get(connected(), key),
    has: (_target, key) => Reflect.has(connected(), key),
    ownKeys: () => Reflect.ownKeys(connected()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(connected(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  return {
    api,
    dispose: () => {
      service?.stop();
      owner.dispose();
    },
  };
}
