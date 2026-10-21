import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { interpret, type Service } from "@spin/runtime/fsm";
import {
  connectRobotNumberInput,
  type NumberInputApi,
  type NumberInputConnectProps,
  type NumberInputService,
} from "./number-input.connect.ts";
import {
  isValueWithinRange,
  numberInput,
  numberInputScalars,
  parseValue,
  valueOf,
  type NumberInputArgs,
  type NumberInputContext,
  type NumberInputEvent,
  type NumberInputScalarKey,
} from "./number-input.machine.ts";

export interface NumberInputValueChange {
  readonly value: string;
  readonly valueAsNumber: number;
}

export interface NumberInputValueCommit {
  readonly value: string;
  readonly valueAsNumber: number;
}

export type NumberInputInvalidReason = "rangeOverflow" | "rangeUnderflow";

export interface NumberInputValueInvalid {
  readonly reason: NumberInputInvalidReason;
  readonly value: string;
  readonly valueAsNumber: number;
}

export interface NumberInputFocusChange {
  readonly focused: boolean;
  readonly value: string;
  readonly valueAsNumber: number;
}

export interface NumberInputCallbacks {
  readonly onValueChange: ((details: NumberInputValueChange) => void) | undefined;
  readonly onValueCommit: ((details: NumberInputValueCommit) => void) | undefined;
  readonly onValueInvalid: ((details: NumberInputValueInvalid) => void) | undefined;
  readonly onFocusChange: ((details: NumberInputFocusChange) => void) | undefined;
}

/** Zag's defaults, before any prop is authored. */
const DEFAULT_INPUT_MODE = "decimal";
const DEFAULT_PATTERN = "-?[0-9]*(.[0-9]+)?";
const INCREMENT_LABEL = "increment value";
const DECREMENT_LABEL = "decrease value";

/** The scalars the assigns read, synced from scope by the bridge. */
type ScalarKey = NumberInputScalarKey;

const sameScalars = (
  context: NumberInputContext,
  next: Pick<NumberInputContext, ScalarKey>,
): boolean =>
  context.min === next.min &&
  context.max === next.max &&
  context.step === next.step &&
  context.largeStep === next.largeStep &&
  context.smallStep === next.smallStep &&
  context.allowOverflow === next.allowOverflow &&
  context.clampValueOnBlur === next.clampValueOnBlur &&
  context.spinOnPress === next.spinOnPress;

function asString(raw: unknown, fallback: string): string {
  return typeof raw === "string" && raw.length > 0 ? raw : fallback;
}

/** A string prop that means "unset" when empty. */
function asOptional(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

/** The first state's value: the authored `value` when the host wrote one, and
 * `defaultValue` otherwise. Both are the platform's own strings. */
function seedValue(p: Record<string, unknown>, authored: (name: string) => boolean): string {
  const controlled = authored("value") ? valueOf(p["value"]) : null;
  if (controlled !== null) return controlled;
  const fallback = p["defaultValue"];
  return typeof fallback === "string" ? fallback : "";
}

/**
 * The number-input bridge: scope values in, machine state out.
 *
 * Four jobs. Seed the first state from `defaultValue`; alternate it from an
 * authored `value`; sync the scalars the assigns read (the bounds, the three
 * step sizes, and the three behaviour flags); and publish the connect api
 * through the live-view proxy.
 *
 * The callbacks are Zag's, resolved here rather than in the machine: what
 * each one means is a statement about a machine move, so the bridge reports
 * them the way Zag's watchers and blur branches do — the commit on the two
 * committing events, the invalid report when the range state moves or a blur
 * leaves an out-of-range value standing, and the focus whenever the machine
 * leaves or returns to `idle`.
 */
export function createNumberInputBridge(
  props: () => Record<string, unknown>,
  _root: () => Element,
  id: string,
): { readonly api: NumberInputApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  let service: Service<NumberInputContext, NumberInputEvent> | undefined;
  /** What a form reset restores: the seed, captured with the service. */
  let initialValue = "";

  const authored = (name: string): boolean => {
    const predicate = props()["@@authored"];
    return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
  };

  /**
   * A behaviour flag whose default is `true`: a coerced `false` is not a
   * write, so only an authored prop can turn these off.
   */
  function flagOn(p: Record<string, unknown>, name: string): boolean {
    return authored(name) ? p[name] === true : true;
  }

/**
 * The arguments the machine is built from: the host's own props, shaped the
 * way the machine reads them. The twin (`defaultValue`) is the framework's
 * convention, so the seed picks the live value when the host wrote one and
 * the twin otherwise.
 */
function readArgs(): NumberInputArgs {
  const p = props();
  const allowOverflow = p["allowOverflow"] === true;
  return {
    value: seedValue(p, authored),
    // The twin travels with the arguments: the machine's own gate reads it
    // to tell a declared default from an unwritten channel, so a narrowed
    // bag that drops it loses the seed.
    defaultValue: p["defaultValue"] as string | undefined,
    min: p["min"] as string | number,
    max: p["max"] as string | number,
    step: p["step"] as string | number,
    largeStep: p["largeStep"] as string | number,
    smallStep: p["smallStep"] as string | number,
    allowOverflow,
    // Zag: `clampValueOnBlur` defaults to the opposite of `allowOverflow`,
    // and a coerced default is not a write.
    clampValueOnBlur: authored("clampValueOnBlur")
      ? p["clampValueOnBlur"] === true
      : !allowOverflow,
    spinOnPress: flagOn(p, "spinOnPress"),
  };
}

  function readContextProps(): Pick<NumberInputContext, ScalarKey> {
    // The machine shapes the scalars; the bridge reads them off the same
    // arguments the machine was built from.
    return numberInputScalars(readArgs());
  }

  function readConnectProps(): NumberInputConnectProps {
    const p = props();
    return {
      ...readContextProps(),
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      required: p["required"] === true,
      // An authored `invalid` wins over the range check; a coerced default is
      // not a write, so the range still speaks for the default.
      invalid: authored("invalid") ? p["invalid"] === true : undefined,
      allowMouseWheel: p["allowMouseWheel"] === true,
      focusInputOnChange: flagOn(p, "focusInputOnChange"),
      inputMode: asString(p["inputMode"], DEFAULT_INPUT_MODE),
      pattern: asString(p["pattern"], DEFAULT_PATTERN),
      name: asOptional(p["name"]),
      form: asOptional(p["form"]),
      incrementLabel: asString(p["incrementLabel"], INCREMENT_LABEL),
      decrementLabel: asString(p["decrementLabel"], DECREMENT_LABEL),
      initialValue,
    };
  }

  const readCallbacks = (): NumberInputCallbacks => {
    const p = props();
    const pick = <T>(name: string): T | undefined => {
      const value = p[name];
      return typeof value === "function" ? (value as T) : undefined;
    };
    return {
      onValueChange: pick<(d: NumberInputValueChange) => void>("onValueChange"),
      onValueCommit: pick<(d: NumberInputValueCommit) => void>("onValueCommit"),
      onValueInvalid: pick<(d: NumberInputValueInvalid) => void>("onValueInvalid"),
      onFocusChange: pick<(d: NumberInputFocusChange) => void>("onFocusChange"),
    };
  };

  function ensureService(): Service<NumberInputContext, NumberInputEvent> {
    if (service) return service;
    // The machine is a factory over the arguments: it builds its own
    // context from them, so every instance of the element seeds — and then
    // reads — its own context.
    //
    // An authored `value` is the first state, exactly as Zag's bindable
    // prefers it; `defaultValue` seeds the uncontrolled case. Either way
    // the seed tells no one — a controlled host is not told the value it
    // just wrote.
    const machine = numberInput(readArgs(), authored);
    initialValue = machine.initialState.context.value;
    service = owner.run(() => interpret(machine).start());
    return service;
  }

  const detail = (value: string): NumberInputValueChange => ({
    value,
    valueAsNumber: parseValue(value),
  });

  /** Cursors for the diffs the callbacks are derived from. */
  const seeded = ensureService().state.context;
  let lastValue = seeded.value;
  let lastOutOfRange = !isValueWithinRange(parseValue(seeded.value), seeded.min, seeded.max);
  let lastFocused = false;

  function reportInvalid(value: string, max: number): void {
    readCallbacks().onValueInvalid?.({
      reason: parseValue(value) > max ? "rangeOverflow" : "rangeUnderflow",
      ...detail(value),
    });
  }

  /**
   * Report what the move did. Zag's bindable fires `onValueChange` from
   * inside the write, so a move that leaves the value alone reports nothing.
   */
  function notify(type: string): void {
    const after = ensureService().state.context;
    const scalars = readContextProps();
    const callbacks = readCallbacks();

    if (after.value !== lastValue) {
      lastValue = after.value;
      callbacks.onValueChange?.(detail(after.value));
    }

    const out = !isValueWithinRange(parseValue(after.value), scalars.min, scalars.max);
    const flipped = out !== lastOutOfRange;
    lastOutOfRange = out;

    if (type === "INPUT.BLUR" || type === "INPUT.ENTER") {
      callbacks.onValueCommit?.(detail(after.value));
      // Enter commits without leaving the field, but Zag reports the blur.
      if (lastFocused) {
        lastFocused = false;
        callbacks.onFocusChange?.({ focused: false, ...detail(after.value) });
      }
      // Only the blur branch that leaves an out-of-range value standing
      // reports: the clamped branch has already brought it back in.
      if (type === "INPUT.BLUR" && out) reportInvalid(after.value, scalars.max);
      return;
    }

    // A range flip caused by typing is Zag's `INPUT.CHANGE` guard: the host is
    // still writing, and a blur will report it if it survives.
    if (out && flipped && type !== "INPUT.CHANGE") reportInvalid(after.value, scalars.max);
    if (ensureService().state.value !== "idle" && !lastFocused) {
      lastFocused = true;
      callbacks.onFocusChange?.({ focused: true, ...detail(after.value) });
    }
  }

  /**
   * Controlled alternation plus the scalar sync, in one owned effect: it
   * reads the live prop signals, so a host write — property or attribute —
   * moves the machine without waiting for a machine event.
   *
   * It writes no tick of its own: a tick read here would be a dependency, and
   * every later send would re-run this effect and re-impose the authored prop
   * over the machine's own move.
   */
  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const next = readContextProps();
      if (!sameScalars(svc.state.context, next)) Object.assign(svc.state.context, next);
      if (authored("value")) {
        const wanted = valueOf(props()["value"]);
        // A write the machine cannot read is the host's, and leaving it alone
        // is the only thing that does not invent a value.
        if (wanted !== null && svc.state.context.value !== wanted) {
          untrack(() => {
            svc.state.context.value = wanted;
          });
        }
      }
      notify("PROPS.SYNC");
    }),
  );

  function send(event: NumberInputEvent): void {
    const svc = ensureService();
    Object.assign(svc.state.context, readContextProps());
    svc.send(event);
    notify(event.type);
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  }

  /** The service surface the connect reads. Built once: the connect lives as
   * long as the bridge does, so this is the stable accessor it caches
   * against. */
  const serviceApi: NumberInputService = {
    send: send as (event: { type: string } & Record<string, unknown>) => void,
    get context(): NumberInputContext {
      return ensureService().state.context;
    },
    get focused(): boolean {
      return ensureService().state.value !== "idle";
    },
    get scrubbing(): boolean {
      return ensureService().state.value === "scrubbing";
    },
  };

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state, so rebuilding it per move would hand every
   * binding a fresh bag and detach every listener each move. */
  let inputConnect: NumberInputApi | undefined;
  const ensureConnect = (): NumberInputApi => {
    inputConnect ??= connectRobotNumberInput(serviceApi, readConnectProps, id);
    return inputConnect;
  };

  /** The api is read on every machine move, so this depends on the tick and
   * hands out the same connect each time. */
  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as NumberInputApi, {
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
    dispose: (): void => {
      service?.stop();
      owner.dispose();
    },
  };
}
