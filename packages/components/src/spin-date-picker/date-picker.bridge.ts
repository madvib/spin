import { computed, effect, machineTick, scope, signal, untrack } from "@spin/runtime";
import { createMachine, interpret, type Service } from "@spin/runtime/fsm";
import {
  connectRobotDatePicker,
  type DatePickerApi,
  type DatePickerConnectProps,
} from "./date-picker.connect.ts";
import {
  clampDay,
  config,
  dayAsString,
  implementations,
  valueAsAllStrings,
  type DatePickerContext,
  type DatePickerEvent,
  type DatePickerSelectionMode,
  type DatePickerValue,
  type DatePickerView,
} from "./date-picker.machine.ts";

export type {
  DatePickerSelectionMode,
  DatePickerView,
  DatePickerValue,
  DatePickerValueChange,
} from "./date-picker.machine.ts";
import type { DatePickerValueChange } from "./date-picker.machine.ts";

/** An authored-prop predicate: a coerced default is never a host write. */
const authored = (props: () => Record<string, unknown>, name: string): boolean => {
  const predicate = props()["@@authored"];
  return typeof predicate === "function" ? (predicate as (n: string) => boolean)(name) : false;
};

/** An ISO string parses to a day; anything else is not a day. */
const parseDay = (raw: unknown): DatePickerValue | null => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const time = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  const at = new Date(time);
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
};

/** The JSON transport for trees also carries here: `["2024-01-15"]`,
 * and a bare ISO string is the single-day shorthand. */
const parseDays = (raw: unknown): DatePickerValue[] | null => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (raw.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed)) return null;
    const days: DatePickerValue[] = [];
    for (const entry of parsed) {
      const day = parseDay(entry);
      if (day !== null) days.push(day);
    }
    return days;
  }
  const day = parseDay(raw);
  return day === null ? null : [day];
};

const readSelectionMode = (props: Record<string, unknown>): DatePickerSelectionMode => {
  const mode = props["selectionMode"];
  return mode === "multiple" || mode === "range" ? mode : "single";
};

const readView = (props: Record<string, unknown>): DatePickerView => {
  const view = props["view"];
  return view === "month" || view === "year" ? view : "day";
};

/** The browser's today in UTC — the grid's landing day when nothing seeds. */
const todayUtc = (): DatePickerValue => {
  const at = new Date();
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
};

/**
 * The date-picker bridge: scope values in, machine state out.
 *
 * Four jobs. Seed the first state from the authored ISO `value` (or
 * `defaultValue`, or the focused day), alternate the controlled `value`,
 * `focusedValue`, `view`, and `open` from authored props, sync the scalars
 * the assigns read, and publish the connect api through the live-view
 * proxy.
 *
 * The open state is the one channel that is both a prop and a mode: an
 * authored `open` seeds it, and the host's `open-change` reports the
 * machine's moves back. The change callbacks fire from one funnel after
 * every send — the fork's send is synchronous, so a "before" snapshot is
 * the only honest diff.
 */
export function createDatePickerBridge(
  props: () => Record<string, unknown>,
  root: () => Element,
  id: string,
): { readonly api: DatePickerApi; dispose(): void } {
  void root;
  const owner = scope();
  const tick = signal(0);
  const machine = createMachine<DatePickerContext, DatePickerEvent>(config, implementations);

  let service: Service<DatePickerContext, DatePickerEvent> | undefined;

  const ensureService = (): Service<DatePickerContext, DatePickerEvent> => {
    if (service !== undefined) return service;
    const p = props();
    service = owner.run(() => {
      const svc = interpret(machine).start();
      // A send first: the fork's initial context is the config's object
      // until a transition folds a copy, and two pickers on a page would
      // otherwise share one context until the first click.
      svc.send({ type: "VALUE.CLEAR" });
      svc.state.context.selectionMode = readSelectionMode(p);
      svc.state.context.numOfMonths = typeof p["numOfMonths"] === "number" ? p["numOfMonths"] : 1;
      svc.state.context.min = typeof p["min"] === "string" && p["min"].length > 0 ? p["min"] : null;
      svc.state.context.max = typeof p["max"] === "string" && p["max"].length > 0 ? p["max"] : null;
      svc.state.context.closeOnSelect = p["closeOnSelect"] !== false;
      const seededDays = parseDays(p["value"]) ?? parseDays(p["defaultValue"]);
      if (seededDays !== null && seededDays.length > 0) {
        svc.send({ type: "VALUE.SET", value: seededDays });
      }
      const focused = parseDay(p["focusedValue"]) ?? parseDay(p["defaultFocusedValue"]) ??
        seededDays?.[0] ?? todayUtc();
      if (focused !== null) {
        svc.send({ type: "FOCUS.SET", value: clampDay(focused, svc.state.context.min, svc.state.context.max) });
      }
      const view = readView(p);
      if (view !== "day") svc.send({ type: "VIEW.SET", view });
      if (authored(props, "open") && p["open"] === true) svc.send({ type: "OPEN" });
      return svc;
    });
    return service;
  };

  /** The behavioural props, read per connect call: the connect is
   * long-lived, so a snapshot would freeze the first read's values inside
   * the handlers it caches. */
  const readConnectProps = (): DatePickerConnectProps => {
    const p = props();
    const label = p["label"];
    const placeholder = p["placeholder"];
    const locale = typeof p["locale"] === "string" && p["locale"].length > 0 ? p["locale"] : "en-US";
    return {
      locale,
      startOfWeek: typeof p["startOfWeek"] === "number" ? p["startOfWeek"] : 0,
      label: typeof label === "string" ? label : "",
      placeholder: typeof placeholder === "string" ? placeholder : "Pick a date",
      format: (value: DatePickerValue) => {
        const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
        return new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(date);
      },
      disabled: p["disabled"] === true,
      invalid: p["invalid"] === true,
      readOnly: p["readOnly"] === true,
      dir: p["dir"] === "rtl" ? "rtl" : "ltr",
    };
  };

  function send(event: DatePickerEvent): void {
    const svc = ensureService();
    const beforeValue = svc.state.context.value.map(dayAsString).join(",");
    const beforeFocus = dayAsString(svc.state.context.focusedValue);
    const beforeView = svc.state.context.view;
    const wasOpen = svc.state.value === "open";
    svc.send(event);
    const after = svc.state.context;
    if (after.value.map(dayAsString).join(",") !== beforeValue) {
      (props()["onValueChange"] as ((d: DatePickerValueChange) => void) | undefined)?.({
        value: after.value,
        valueAsString: valueAsAllStrings(after.value),
      });
    }
    if (dayAsString(after.focusedValue) !== beforeFocus) {
      (props()["onFocusChange"] as ((d: { focusedValue: DatePickerValue; view: DatePickerView }) => void) | undefined)?.({
        focusedValue: after.focusedValue,
        view: after.view,
      });
    }
    if (after.view !== beforeView) {
      (props()["onViewChange"] as ((d: { view: DatePickerView }) => void) | undefined)?.({ view: after.view });
    }
    const isOpen = svc.state.value === "open";
    if (isOpen !== wasOpen) {
      (props()["onOpenChange"] as ((d: { open: boolean }) => void) | undefined)?.({ open: isOpen });
    }
    tick(tick() + 1);
    machineTick(machineTick() + 1);
  }

  ensureService();
  let lastOpen: boolean | undefined = undefined;

  /** One connect per element, not one per machine move. */
  let pickerConnect: DatePickerApi | undefined;
  const ensureConnect = (): DatePickerApi => {
    pickerConnect ??= connectRobotDatePicker(
      {
        send,
        get context(): DatePickerContext {
          return ensureService().state.context;
        },
        get isOpen(): boolean {
          return ensureService().state.value === "open";
        },
      },
      readConnectProps,
      id,
    );
    return pickerConnect;
  };

  owner.run(() =>
    effect(() => {
      const svc = ensureService();
      const p = props();
      svc.state.context.selectionMode = readSelectionMode(p);
      svc.state.context.numOfMonths = typeof p["numOfMonths"] === "number" ? p["numOfMonths"] : 1;
      svc.state.context.min = typeof p["min"] === "string" && p["min"].length > 0 ? p["min"] : null;
      svc.state.context.max = typeof p["max"] === "string" && p["max"].length > 0 ? p["max"] : null;
      svc.state.context.closeOnSelect = p["closeOnSelect"] !== false;
      // A controlled `open` is a PLATFORM concern (select's pattern): the
      // host writes the property, and the machine answers with OPEN/CLOSE.
      // Only a VALUE CHANGE sends — a declared default never re-imposes.
      if (authored(props, "open")) {
        const outer = p["open"] === true;
        if (lastOpen !== outer) {
          lastOpen = outer;
          untrack(() => send(outer ? { type: "OPEN" } : { type: "CLOSE" }));
        }
      }
      if (authored(props, "value")) {
        const outer = parseDays(p["value"]) ?? [];
        const inner = svc.state.context.value.map(dayAsString);
        if (outer.map(dayAsString).join(",") !== inner.join(",")) {
          untrack(() => send({ type: "VALUE.SET", value: outer }));
        }
      }
      if (authored(props, "focusedValue")) {
        const outer = parseDay(p["focusedValue"]);
        const inner = dayAsString(svc.state.context.focusedValue);
        if (outer !== null && dayAsString(outer) !== inner) {
          untrack(() => send({ type: "FOCUS.SET", value: outer }));
        }
      }
      if (authored(props, "view")) {
        const view = readView(p);
        if (view !== svc.state.context.view) untrack(() => send({ type: "VIEW.SET", view }));
      }
    }),
  );

  const connected = computed(() => {
    tick();
    return ensureConnect();
  });

  const api = new Proxy({} as DatePickerApi, {
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
