import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  connectRobotDateInput,
  type DateInputApi,
  type DateInputConnectProps,
} from "./date-input.connect.ts";
import {
  clampValue,
  config,
  dateToFields,
  implementations,
  valueAsString,
  type DateGranularity,
  type DateInputContext,
  type DateInputEvent,
  type DateInputValueChange,
  type DateValue,
} from "./date-input.machine.ts";

export type { DateInputValueChange };
export type { DateValue };

/** The authored-prop predicate: a coerced default is never a host write. */
const authored = (props: () => Record<string, unknown>, name: string): boolean => {
  const predicate = props()["@@authored"];
  return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
};

/** An ISO date string parses to a value; anything else is not a value. */
const parseValue = (raw: unknown): DateValue | null => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const time = Date.parse(raw);
  if (Number.isNaN(time)) return null;
  const at = new Date(time);
  return {
    year: at.getUTCFullYear(),
    month: at.getUTCMonth() + 1,
    day: at.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  };
};

const readGranularity = (props: Record<string, unknown>): DateGranularity => {
  const granularity = props["granularity"];
  return granularity === "hour" || granularity === "minute" || granularity === "second" ? granularity : "day";
};

const readHourCycle = (props: Record<string, unknown>): 12 | 24 =>
  props["hourCycle"] === 24 ? 24 : 12;

const readBound = (props: Record<string, unknown>, name: string): string | null => {
  const bound = props[name];
  return typeof bound === "string" && bound.length > 0 ? bound : null;
};

/**
 * The date-input bridge: scope values in, machine state out.
 *
 * Four jobs. Seed the first state from the authored ISO `value` (or
 * `defaultValue`), alternate the controlled `value` from an authored prop,
 * sync the scalars the assigns read (granularity, hourCycle, min, max),
 * and publish the connect api through the live-view proxy.
 *
 * The change callback fires from one funnel after every send — the fork's
 * send is synchronous, so a "before" snapshot is the only honest diff.
 */
export function createDateInputBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: DateInputApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<DateInputContext, DateInputEvent>(config, implementations);

  let service: Service<DateInputContext, DateInputEvent> | undefined;

  const ensureService = (): Service<DateInputContext, DateInputEvent> => {
    if (service !== undefined) return service;
    const p = props();
    service = owner.run(() => {
      const svc = interpret(machine).start();
      // A send first: the fork's initial context is the config's object
      // until a transition folds a copy, and two date inputs on a page
      // would otherwise share one context until the first keystroke.
      svc.send({ type: "VALUE.CLEAR" });
      svc.state.context.granularity = readGranularity(p);
      svc.state.context.hourCycle = readHourCycle(p);
      svc.state.context.min = readBound(p, "min");
      svc.state.context.max = readBound(p, "max");
      const seed = authored(props, "value") ? parseValue(p["value"]) : parseValue(p["defaultValue"]);
      if (seed !== null) svc.send({ type: "VALUE.SET", value: seed });
      return svc;
    });
    return service;
  };

  /** The behavioural props, read per connect call rather than snapshotted:
   * the connect is long-lived, so a host write has to reach the handlers it
   * holds. */
  const readConnectProps = (): DateInputConnectProps => {
    const p = props();
    const label = p["label"];
    const name = p["name"];
    const form = p["form"];
    const placeholder = p["placeholder"];
    return {
      granularity: ensureService().state.context.granularity,
      hourCycle: ensureService().state.context.hourCycle,
      label: typeof label === "string" ? label : "",
      name: typeof name === "string" && name.length > 0 ? name : undefined,
      form: typeof form === "string" && form.length > 0 ? form : undefined,
      placeholder: typeof placeholder === "string" ? placeholder : "",
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true,
      required: p["required"] === true,
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      autoFocus: p["autoFocus"] === true,
    };
  };

  function send(event: DateInputEvent): void {
    const svc = ensureService();
    const before = valueAsString(svc.state.context.value);
    svc.send(event);
    const after = svc.state.context.value;
    if (valueAsString(after) !== before) {
      (props()["onValueChange"] as ((d: DateInputValueChange) => void) | undefined)?.({
        value: after,
        valueAsString: valueAsString(after),
      });
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  }

  /**
   * One owned effect for the inbound props: the scalars the assigns read,
   * and the controlled value. Both alternate immediately, without waiting
   * for a machine event.
   *
   * The write is untracked — the send inside it reads `machineTick` to bump
   * it, and a tracked read here would subscribe this effect to the signal
   * every machine move bumps: each keystroke would re-run the effect and
   * re-impose the authored prop over the machine's own move.
   */
  ensureService();

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state, so rebuilding it per move would detach listeners
   * mid-gesture. */
  let dateConnect: DateInputApi | undefined;
  const ensureConnect = (): DateInputApi => {
    dateConnect ??= connectRobotDateInput(
      {
        send,
        get context(): DateInputContext {
          return ensureService().state.context;
        },
        get focused(): boolean {
          return ensureService().state.value === "focused";
        },
      },
      readConnectProps,
      id,
      root,
    );
    return dateConnect;
  };

  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const p = props();
      let moved = false;
      const granularity = readGranularity(p);
      if (svc.state.context.granularity !== granularity) {
        svc.state.context.granularity = granularity;
        moved = true;
      }
      const hourCycle = readHourCycle(p);
      if (svc.state.context.hourCycle !== hourCycle) {
        svc.state.context.hourCycle = hourCycle;
        svc.state.context.fields = dateToFields(svc.state.context.value, hourCycle);
        moved = true;
      }
      const min = readBound(p, "min");
      if (svc.state.context.min !== min) {
        svc.state.context.min = min;
        moved = true;
      }
      const max = readBound(p, "max");
      if (svc.state.context.max !== max) {
        svc.state.context.max = max;
        moved = true;
      }
      if (authored(props, "value")) {
        const outer = parseValue(p["value"]);
        const inner = svc.state.context.value;
        if (valueAsString(outer) !== valueAsString(inner)) {
          // Through the connect, not the raw service: the controlled write
          // is a send like any other, so the view's reflexes run for it too.
          untrack(() => ensureConnect().setValue(clampValue(outer, min, max)));
          moved = true;
        }
      }
      if (moved) untrack(() => tick(tick() + 1));
    }),
  );

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as DateInputApi, {
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
