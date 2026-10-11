import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  connectRobotPinInput,
  type PinInputApi,
  type PinInputConnectProps,
  type PinInputSanitize,
  type PinInputTranslations,
} from "./pin-input.connect.ts";
import {
  config,
  implementations,
  pinView,
  type PinInputContext,
  type PinInputEvent,
  type PinInputValueChange,
  type PinInputValueComplete,
  type PinInputValueInvalid,
} from "./pin-input.machine.ts";

export type {
  PinInputValueChange,
  PinInputValueComplete,
  PinInputValueInvalid,
};

/** The element's declared cell count, for a prop that arrives unwritten. */
const DEFAULT_COUNT = 4;
/** Zag's placeholder default. */
const DEFAULT_PLACEHOLDER = "\u25CB";

const defaultTranslations: PinInputTranslations = {
  inputLabel: (index: number, length: number): string => `pin code ${index + 1} of ${length}`,
};

/**
 * Zag's `mergeWithDefault`: a host overrides individual members and the
 * rest keep their English default. The shape is validated here rather than
 * trusted at every read.
 */
function parseTranslations(raw: unknown): PinInputTranslations {
  if (typeof raw !== "object" || raw === null) return defaultTranslations;
  const inputLabel: unknown = Reflect.get(raw, "inputLabel");
  return {
    inputLabel: typeof inputLabel === "function"
      ? (inputLabel as PinInputTranslations["inputLabel"])
      : defaultTranslations.inputLabel,
  };
}

/**
 * A prop the scope grammar cannot declare. Function- and object-valued host
 * inputs (`sanitizeValue`, `translations`) have no bool|string|int|array
 * form, so the element property they are written to is the channel: the
 * framework hooks write every host prop as an element property, and the
 * bridge reads it back off the root. Read live, so a late write reaches the
 * next keystroke.
 */
const hostProp = (root: () => Element, name: string): unknown => Reflect.get(root(), name);

/**
 * The value travels the prop channel as an array (a property write) or a
 * comma-joined string (an attribute write), and the grammar's own default
 * for an array prop arrives as the string `"[]"` parsed into one cell. A
 * cell holds exactly one character, so everything else is dropped here
 * rather than trusted at the read.
 */
const parseChars = (raw: unknown): string[] => {
  const parts = Array.isArray(raw)
    ? raw.filter((part): part is string => typeof part === "string")
    : typeof raw === "string"
      ? raw.split(",").map((part) => part.trim())
      : [];
  return parts.filter((part) => part.length === 1);
};

const sameChars = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const readCount = (props: Record<string, unknown>): number => {
  const count = props["count"];
  return typeof count === "number" && Number.isFinite(count)
    ? Math.max(0, Math.trunc(count))
    : DEFAULT_COUNT;
};

/** The authored-prop predicate: a coerced default is never a host write. */
const authored = (props: () => Record<string, unknown>, name: string): boolean => {
  const predicate = props()["@@authored"];
  return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
};

/**
 * The pin-input bridge: scope values in, machine state out.
 *
 * Four jobs. Seed the first state from `defaultValue` (or the authored
 * `value`), park the index on the first cell under `autoFocus`, alternate
 * the controlled `value` from an authored prop, and publish the connect api
 * through the live-view proxy.
 *
 * The change callbacks all fire from one funnel after every send — the
 * fork's send is synchronous, so a "before" snapshot is the only honest
 * diff. `value-complete` is an edge report, exactly as Zag's watch on
 * `isValueComplete` is; `value-invalid` is the refused keystroke, which the
 * view has already told the machine about.
 */
export function createPinInputBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: PinInputApi; dispose(): void } {
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<PinInputContext, PinInputEvent>(config, implementations);

  let service: Service<PinInputContext, PinInputEvent> | undefined;

  const ensureService = (): Service<PinInputContext, PinInputEvent> => {
    if (service !== undefined) return service;
    const p = props();
    const count = readCount(p);
    const seed = authored(props, "value") ? parseChars(p["value"]) : parseChars(p["defaultValue"]);
    service = owner.run(() => {
      const svc = interpret(machine).start();
      // A send first: the fork's initial context is the config's object
      // until a transition folds a copy, and two pin inputs on a page would
      // otherwise share one context until the first keystroke. Seeding goes
      // through the raw service, so a seed never reports a change.
      svc.send({ type: "VALUE.SET", value: [] });
      // Zag's `fill(defaultValue, count)`: the seed is the whole pin — every
      // cell accounted for, the empty ones included.
      svc.state.context.count = count;
      svc.state.context.focusedIndex = p["autoFocus"] === true ? 0 : -1;
      svc.send({ type: "VALUE.SET", value: seed });
      return svc;
    });
    return service;
  };

  /** The behavioural props, read per connect call rather than snapshotted:
   * the connect is long-lived, so a host write has to reach the handlers it
   * holds. */
  const readConnectProps = (): PinInputConnectProps => {
    const p = props();
    const type = p["type"];
    const name = p["name"];
    const form = p["form"];
    const placeholder = p["placeholder"];
    const pattern = p["pattern"];
    const sanitize: unknown = hostProp(root, "sanitizeValue");
    return {
      count: ensureService().state.context.count,
      type: type === "alphabetic" || type === "alphanumeric" ? type : "numeric",
      pattern: typeof pattern === "string" ? pattern : "",
      mask: p["mask"] === true,
      otp: p["otp"] === true,
      placeholder: typeof placeholder === "string" ? placeholder : DEFAULT_PLACEHOLDER,
      disabled: p["disabled"] === true,
      readOnly: p["readOnly"] === true,
      invalid: p["invalid"] === true,
      required: p["required"] === true,
      name: typeof name === "string" && name.length > 0 ? name : undefined,
      form: typeof form === "string" && form.length > 0 ? form : undefined,
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
      autoFocus: p["autoFocus"] === true,
      autoSubmit: p["autoSubmit"] === true,
      blurOnComplete: p["blurOnComplete"] === true,
      selectOnFocus: p["selectOnFocus"] === true,
      sanitize: typeof sanitize === "function" ? (sanitize as PinInputSanitize) : (value: string) => value,
      translations: parseTranslations(hostProp(root, "translations")),
    };
  };

  const fireCallbacks = (
    before: { readonly value: readonly string[]; readonly complete: boolean },
    after: PinInputContext,
    event: PinInputEvent,
  ): void => {
    const p = props();
    const view = pinView(after.value, after.count);
    const changed = !sameChars(before.value, after.value);
    if (changed) {
      (p["onValueChange"] as ((d: PinInputValueChange) => void) | undefined)?.({
        value: [...view.chars],
        valueAsString: view.asString,
      });
    }
    if (!before.complete && view.complete) {
      (p["onValueComplete"] as ((d: PinInputValueComplete) => void) | undefined)?.({
        value: [...view.chars],
        valueAsString: view.asString,
      });
    }
    if (event.type === "VALUE.INVALID") {
      (p["onValueInvalid"] as ((d: PinInputValueInvalid) => void) | undefined)?.({
        value: event.value,
        index: after.focusedIndex,
      });
    }
  };

  function send(event: PinInputEvent): void {
    const svc = ensureService();
    const before = {
      value: [...svc.state.context.value],
      complete: pinView(svc.state.context.value, svc.state.context.count).complete,
    };
    svc.send(event);
    const after = svc.state.context;
    fireCallbacks(before, after, event);
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  }

  /**
   * One owned effect for the inbound props: the cell count the assigns fill
   * to, and the controlled value. Both alternate immediately, without
   * waiting for a machine event.
   *
   * The write is untracked — the send inside it reads `machineTick` to bump
   * it, and a tracked read here would subscribe this effect to the signal
   * every machine move bumps: each keystroke would re-run the effect and
   * re-impose the authored prop over the machine's own move.
   */
  ensureService();

  /** One connect per element, not one per machine move: its bags are cached
   * against machine state and its cell handlers against the cells
   * themselves, so rebuilding it per move would detach listeners and
   * re-insert inputs mid-gesture. */
  let pinConnect: PinInputApi | undefined;
  const ensureConnect = (): PinInputApi => {
    pinConnect ??= connectRobotPinInput(
      {
        send,
        get context(): PinInputContext {
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
    return pinConnect;
  };

  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const p = props();
      let moved = false;
      const count = readCount(p);
      if (svc.state.context.count !== count) {
        svc.state.context.count = count;
        moved = true;
      }
      if (authored(props, "value")) {
        const outer = parseChars(p["value"]);
        if (!sameChars(svc.state.context.value, outer)) {
          // Through the connect, not the raw service: the controlled write
          // is a send like any other, so the view's reflexes (focus,
          // completion) run for it too.
          untrack(() => ensureConnect().setValue(outer));
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

  const api = new Proxy({} as PinInputApi, {
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
