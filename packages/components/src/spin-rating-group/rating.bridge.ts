import { computed, effect, machineTick, scope, signal } from "@spin/runtime";
import { createMachine, interpret, type FsmService } from "@spin/runtime/fsm";
import {
  connectRobotRating,
  type RatingFsmApi,
  type RatingFsmConnectProps,
  type RatingService,
} from "./rating.connect.ts";
import {
  config,
  implementations,
  type RatingContext,
  type RatingEvent,
} from "./rating.machine.ts";

export interface RatingValueChange {
  readonly value: number;
}

export interface RatingHoverChange {
  readonly hoveredValue: number;
}

/** The element's imperative surface, declared in the def's `commands` and typed
 * once here so hosts (and tests) call it without a cast. */
export interface RatingCommands {
  setValue(value: number): void;
  clearValue(): void;
}

/** The authored-prop predicate: a coerced default is never a host write. */
const authored = (props: () => Record<string, unknown>, name: string): boolean => {
  const predicate = props()["@@authored"];
  return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
};

/** Numbers cross the property channel as JSON text when the host writes a
 * string, and as numbers when a framework writes a literal. Both are legal;
 * anything else is the default. */
const readNumber = (raw: unknown): number | undefined => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readInt = (raw: unknown, fallback: number): number => {
  const parsed = readNumber(raw);
  if (parsed === undefined) return fallback;
  return Math.max(1, Math.round(parsed));
};

/** Zag's default translation, which is also the one the item bags carry when
 * the host passes nothing. */
const starText = (index: number): string => `${index} stars`;

/** One context scalar, when the prop moved. */
const syncScalar = <K extends keyof RatingContext>(
  context: RatingContext,
  key: K,
  value: RatingContext[K],
): boolean => {
  if (context[key] === value) return false;
  context[key] = value;
  return true;
};

/**
 * The rating bridge: scope values in, machine state out.
 *
 * Three jobs, as every bridge: seed the first value from `defaultValue`,
 * alternate it from an authored `value`, and publish the connect api through
 * the live-view proxy. The scalars the assigns and the connect read
 * (`count`, `allowHalf`, the disabled/readOnly pair) sync through the same
 * owned effect that drives the controlled channel.
 */
export function createRatingFsmBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: RatingFsmApi & RatingCommands; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<RatingContext, RatingEvent>(config, implementations);
  /** A disabled ancestor fieldset, reported by the root's form-control action. */
  const fieldsetDisabled = signal(false);

  let service: FsmService<RatingContext, RatingEvent> | undefined;
  /** The seeded value, which is what a form reset returns to. */
  let seeded = -1;

  const ensureService = (): FsmService<RatingContext, RatingEvent> => {
    if (service) return service;
    const p = props();
    seeded = readNumber(p["defaultValue"]) ?? -1;
    service = owner.run(() => {
      const svc = interpret(machine).start();
      // Seed through an event, not a context write: the fork's initial
      // context IS the config's object until a transition folds a copy, so
      // two ratings on a page would otherwise share one context.
      svc.send({ type: "SET_VALUE", value: seeded });
      Object.assign(svc.state.context, {
        count: readInt(p["count"], 5),
        allowHalf: p["allowHalf"] === true,
        readOnly: p["readOnly"] === true,
        disabled: p["disabled"] === true,
        hasFocus: false,
      });
      return svc;
    });
    // A controlled value overrides the seed before the first read, and the
    // imposition is silent: a host's initial write is the starting state,
    // not a change.
    const outer = controlledValue();
    if (outer !== undefined) service.state.context.value = outer;
    return service;
  };

  /** The controlled value, when the host authored one. */
  const controlledValue = (): number | undefined => {
    if (!authored(props, "value")) return undefined;
    return readNumber(props()["value"]);
  };

  let lastValue = ensureService().state.context.value;
  let lastHovered = ensureService().state.context.hoveredValue;

  /**
   * Report what moved. The cursors advance only after the callbacks, and both
   * the controlled channel and the machine sends funnel through here — the
   * fork's send is synchronous, so a post-send check would already see the
   * new value.
   */
  const notify = (): void => {
    const context = ensureService().state.context;
    const p = props();
    if (context.value !== lastValue) {
      lastValue = context.value;
      (p["onValueChange"] as ((d: RatingValueChange) => void) | undefined)?.({
        value: context.value,
      });
    }
    if (context.hoveredValue !== lastHovered) {
      lastHovered = context.hoveredValue;
      (p["onHoverChange"] as ((d: RatingHoverChange) => void) | undefined)?.({
        hoveredValue: context.hoveredValue,
      });
    }
  };

  /** The behavioural props, read per connect call rather than snapshotted: the
   * connect is long-lived, so a host write has to reach the handlers it holds. */
  let translateSource: unknown;
  let translateFn: ((index: number) => string) = starText;
  const readConnectProps = (): RatingFsmConnectProps => {
    const p = props();
    // `translations` is a function carrier, so its identity is what memoizes:
    // the same source function must hand the connect the same translate, or
    // every item bag would rebuild on each read.
    const translations = p["translations"];
    const source = typeof translations === "object" && translations !== null
      ? Reflect.get(translations, "ratingValueText")
      : undefined;
    if (typeof source === "function" && source !== translateSource) {
      translateSource = source;
      translateFn = source as (index: number) => string;
    }
    const name = p["name"];
    const form = p["form"];
    const dir = p["dir"];
    return {
      count: readInt(p["count"], 5),
      allowHalf: p["allowHalf"] === true,
      disabled: p["disabled"] === true || fieldsetDisabled(),
      readOnly: p["readOnly"] === true,
      required: p["required"] === true,
      name: typeof name === "string" && name.length > 0 ? name : undefined,
      form: typeof form === "string" && form.length > 0 ? form : undefined,
      dir: typeof dir === "string" && dir.length > 0 ? dir : "ltr",
      translate: translateFn,
      onFormReset: () => send({ type: "SET_VALUE", value: seeded }),
      onDisabledChange: (disabled: boolean) => {
        fieldsetDisabled(disabled);
      },
    };
  };

  /**
   * Controlled alternation plus the scalar sync, in one owned effect: it reads
   * the live prop signals, so a host write — property or attribute — moves the
   * machine without waiting for a machine event.
   *
   * It writes no tick of its own: a tick read here would be a dependency, and
   * every later send would re-run this effect and re-impose the authored prop
   * over the machine's own move.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      // The fieldset channel is a signal, so the effect re-runs when the
      // action reports a change on an ancestor fieldset.
      const disabledField = fieldsetDisabled();
      let moved = false;
      if (
        syncScalar(svc.state.context, "disabled", props()["disabled"] === true || disabledField)
      ) {
        moved = true;
      }
      if (syncScalar(svc.state.context, "readOnly", props()["readOnly"] === true)) moved = true;
      const count = readInt(props()["count"], 5);
      if (syncScalar(svc.state.context, "count", count)) moved = true;
      const allowHalf = props()["allowHalf"] === true;
      if (syncScalar(svc.state.context, "allowHalf", allowHalf)) {
        moved = true;
        // Zag's `watch(allowHalf)`: halves turning off folds the value back
        // onto the whole-star grid.
        if (!allowHalf) svc.send({ type: "ROUND_VALUE" });
      }
      const outer = controlledValue();
      if (outer !== undefined && outer !== svc.state.context.value) {
        svc.state.context.value = outer;
        moved = true;
      }
      if (moved) {
        notify();
        // A scalar the connect reads moved, so the bags it cached against
        // them must be re-read: the api is only re-read when the tick moves.
        tick(tick() + 1);
        machineTick(machineTick() + 1);
      }
    }),
  );

  const send = (event: RatingEvent): void => {
    const svc = ensureService();
    // The assigns read these off the context, so the live props are folded in
    // before the event rather than trusted from seed time.
    Object.assign(svc.state.context, {
      count: readInt(props()["count"], 5),
      allowHalf: props()["allowHalf"] === true,
      readOnly: props()["readOnly"] === true,
      disabled: props()["disabled"] === true || fieldsetDisabled(),
    });
    const outer = controlledValue();
    if (outer !== undefined) svc.state.context.value = outer;
    svc.send(event);
    notify();
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  };

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches against. */
  const serviceApi: RatingService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context() {
      return ensureService().state.context;
    },
    get state() {
      return ensureService().state.value;
    },
  };

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state, and its item handlers are cached against the items
   * themselves. Rebuilding it per move is what made each read hand out fresh
   * item objects. */
  let ratingConnect: RatingFsmApi | undefined;
  const ensureConnect = (): RatingFsmApi => {
    ratingConnect ??= connectRobotRating(
      serviceApi,
      readConnectProps,
      id,
      send as (event: { type: string } & Record<string, unknown>) => void,
    );
    return ratingConnect;
  };

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  // Imperative commands resolve INSIDE the trap: assigning onto a live-view
  // proxy is shadowed by its own get trap and the host would call undefined.
  const commands = {
    setValue: (value: number): void => send({ type: "SET_VALUE", value }),
    clearValue: (): void => send({ type: "CLEAR_VALUE" }),
  };

  const api = new Proxy({} as RatingFsmApi & RatingCommands, {
    get: (_target, key) =>
      key in commands ? Reflect.get(commands, key) : Reflect.get(connected(), key),
    has: (_target, key) => key in commands || Reflect.has(connected(), key),
    ownKeys: () => [...new Set([...Reflect.ownKeys(connected()), ...Object.keys(commands)])],
    getOwnPropertyDescriptor: (_target, key) => {
      if (key in commands) {
        return { configurable: true, enumerable: true, value: Reflect.get(commands, key) };
      }
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
