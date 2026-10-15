import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  config,
  implementations,
  type RatingGroupContext,
  type RatingGroupEvent,
  type RatingGroupValueChange,
} from "./rating-group.machine.ts";
import {
  connectRatingGroup,
  type RatingGroupApi,
  type RatingGroupConnectProps,
  type RatingGroupService,
} from "./rating-group.connect.ts";

/**
 * The rating-group bridge: scope values in, machine state out.
 *
 * Seed the value from `defaultValue`; alternate the one authored channel
 * (`value`) against a remembered shadow so a machine rating of its own is
 * never undone by an unrelated prop change. Report what moved through
 * `value-change` (commit) and `hover-change` (preview). The callbacks live
 * on the props surface — the def maps them to CustomEvents.
 */

export interface RatingGroupHoverChange {
  readonly hoveredValue: number;
}

export interface RatingGroupCallbacks {
  readonly onValueChange: ((details: RatingGroupValueChange) => void) | undefined;
  readonly onHoverChange: ((details: RatingGroupHoverChange) => void) | undefined;
}

const numProp = (raw: unknown): number | null =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : null;

const countProp = (raw: unknown): number | null => {
  const count = numProp(raw);
  return count === null ? null : Math.max(1, Math.floor(count));
};

export function createRatingGroupBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: RatingGroupApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  // The fork's `config.context` is ONE object, and its interpreter starts on
  // it without copying: every rating on the page would otherwise share one
  // value.
  const machine = createMachine<RatingGroupContext, RatingGroupEvent>(
    { ...config, context: { ...config.context } },
    implementations,
  );

  let service: Service<RatingGroupContext, RatingGroupEvent> | undefined;

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  const readCallbacks = (): RatingGroupCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onValueChange: pick<(d: RatingGroupValueChange) => void>("onValueChange"),
      onHoverChange: pick<(d: RatingGroupHoverChange) => void>("onHoverChange"),
    };
  };

  const readContextProps = (): Pick<
    RatingGroupContext,
    "count" | "allowHalf" | "disabled" | "readOnly"
  > => {
    const p = props();
    return {
      count: countProp(p["count"]) ?? 5,
      allowHalf: p["allowHalf"] === true,
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
    };
  };

  const readConnectProps = (): RatingGroupConnectProps => {
    const p = props();
    const label = p["label"];
    const name = p["name"];
    const form = p["form"];
    return {
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      required: p["required"] === true,
      name: typeof name === "string" ? name : "",
      form: typeof form === "string" ? form : "",
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      label: typeof label === "string" ? label : "",
    };
  };

  const ensureService = (): Service<RatingGroupContext, RatingGroupEvent> => {
    if (service) return service;
    const p = props();
    const scalars = readContextProps();
    const seeded = numProp(authored("value") ? p["value"] : p["defaultValue"]) ?? -1;
    service = owner.run(() => {
      const svc = interpret(machine).start("idle");
      Object.assign(svc.state.context, scalars, { value: seeded });
      return svc;
    });
    return service;
  };

  /** What the value channel last imposed, seeded from the same place the
   * machine was, so a host that authors the seeded value writes nothing. */
  let lastValue: number = ensureService().state.context.value;
  let lastHovered = -1;

  let ratingConnect: RatingGroupApi | undefined;
  const ensureConnect = (): RatingGroupApi => {
    ratingConnect ??= connectRatingGroup(serviceApi, readConnectProps, id);
    return ratingConnect;
  };

  /**
   * Report what moved. The cursors advance only after the callbacks: the
   * fork's send is synchronous, so a post-send check would already see the
   * new value.
   */
  const notify = (): void => {
    const after = ensureService().state.context;
    const callbacks = readCallbacks();
    if (lastValue !== after.value) {
      lastValue = after.value;
      callbacks.onValueChange?.({ value: after.value });
    }
    if (lastHovered !== after.hoveredValue) {
      lastHovered = after.hoveredValue;
      callbacks.onHoverChange?.({ hoveredValue: after.hoveredValue });
    }
  };

  const send = (event: RatingGroupEvent): void => {
    const svc = ensureService();
    // The scalars are re-read on every send so an assign or a cond never
    // reads a stale one.
    Object.assign(svc.state.context, readContextProps());
    svc.send(event);
    notify();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: RatingGroupService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get state() {
      return ensureService().state.value;
    },
  };

  /**
   * Controlled alternation plus the scalar sync, in one owned effect: it
   * reads the live prop signals, so a host write — property or attribute —
   * moves the machine without waiting for a machine event.
   *
   * It writes no tick of its own: `svc.send` bumps the machine tick, which
   * is what wakes the bindings, and a tick read here would re-run the effect
   * on every later move and re-impose the authored props over it.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      let moved = false;
      if (authored("value")) {
        const outer = numProp(props()["value"]);
        if (outer !== null && lastValue !== outer) {
          untrack(() => svc.send({ type: "SET_VALUE", value: outer }));
          moved = true;
        }
      }
      if (moved) notify();
    }),
  );

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as RatingGroupApi, {
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
