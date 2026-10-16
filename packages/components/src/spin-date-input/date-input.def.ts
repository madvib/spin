import {
  dataAttr,
  defineComponent,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  clampValue,
  config,
  dateToFields,
  daysInMonth,
  FIELD_LIMITS,
  implementations,
  segmentFields,
  valueAsString,
  type DateGranularity,
  type DateInputContext,
  type DateInputEvent,
  type DateInputField,
  type DateInputValueChange,
  type DateValue,
} from "./date-input.machine.ts";

/**
 * Date-input definition: the DOM contract as data. The machine holds the
 * fields and the active segment; this file maps props to channels, parts
 * to attribute bags, commands to sends, and value transitions to their
 * event.
 *
 * Segments render through `Intl.DateTimeFormat.formatToParts`, which is
 * what decides the order for the locale — month-first in en-US, day-first
 * in en-GB — so the view never hardcodes an order. The machine's segment
 * list (`segmentFields`) is the canonical month/day/year order; the view
 * maps each formatted part back to its field. Literals (slashes, commas,
 * spaces) render as aria-hidden spans between the spinbuttons.
 */

export type { DateInputValueChange, DateValue };

export interface DateInputApi {
  readonly value: DateValue | null;
  readonly valueAsString: string;
  /** Whether a segment holds DOM focus — the focused state, read for the
   * host (and for tests) the way the pin-input reports it. */
  readonly focused: boolean;
  focus(): void;
  setValue(value: DateValue | null): void;
  clearValue(): void;
  getRootProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getControlProps(): Record<string, unknown>;
  getSegments(): readonly DateSegmentView[];
  getSegmentProps(index: number): Record<string, unknown>;
  getHiddenInputProps(): Record<string, unknown>;
}

/** One rendered segment: a field the user edits, or a literal between them. */
export interface DateSegmentView {
  /** Position in the rendered row; unique, so the `for` keys on it. */
  readonly index: number;
  /** Position among editable fields; -1 for literals. Bags key on this. */
  readonly fieldIndex: number;
  readonly field: DateInputField | null;
  readonly text: string;
  readonly placeholder: boolean;
}

const FIELD_LABELS: Readonly<Record<DateInputField, string>> = {
  year: "Year",
  month: "Month",
  day: "Day",
  hour: "Hour",
  minute: "Minute",
  second: "Second",
  dayPeriod: "AM/PM",
};

/** The text a segment shows: the field's value, or its placeholder. */
export const segmentText = (field: DateInputField, value: number | null, hourCycle: 12 | 24): string => {
  if (value === null) return placeholderFor(field);
  switch (field) {
    case "year": return `${value}`.padStart(4, "0");
    case "dayPeriod": return value === 1 ? "PM" : "AM";
    case "hour": return hourCycle === 12 ? `${value}` : value < 10 ? `0${value}` : `${value}`;
    default: return value < 10 ? `0${value}` : `${value}`;
  }
};

/** The placeholder a segment shows for an empty field. */
const placeholderFor = (field: DateInputField): string => {
  switch (field) {
    case "year": return "yyyy";
    case "month": return "mm";
    case "day": return "dd";
    case "hour": return "hh";
    case "minute": return "mm";
    case "second": return "ss";
    case "dayPeriod": return "AM/PM";
  }
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

type Ctx = DateInputContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

/** An Intl part names its field; the probe date keeps every value distinct. */
const partToField = (type: string, hourCycle: 12 | 24): DateInputField | null => {
  switch (type) {
    case "year": return "year";
    case "month": return "month";
    case "day": return "day";
    case "hour": return "hour";
    case "minute": return "minute";
    case "second": return "second";
    case "dayPeriod": return hourCycle === 12 ? "dayPeriod" : null;
    default: return null;
  }
};

/** The formatter is the locale's segment order: format a known date and
 * read the parts back. `formatToParts` on January 22 gives every part a
 * distinct shape, so each part maps to exactly one field. */
const orderFields = (granularity: DateGranularity, hourCycle: 12 | 24): readonly DateInputField[] => {
  const fields = segmentFields(granularity);
  try {
    const probe = new Date(Date.UTC(2024, 0, 22, 13, 44, 55));
    const parts = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      ...(fields.includes("hour") ? { hour: "numeric", hour12: hourCycle === 12 } : {}),
      ...(fields.includes("minute") ? { minute: "2-digit" } : {}),
      ...(fields.includes("second") ? { second: "2-digit" } : {}),
      timeZone: "UTC",
    }).formatToParts(probe);
    const seen: DateInputField[] = [];
    for (const part of parts) {
      const field = partToField(part.type, hourCycle);
      if (field !== null && fields.includes(field) && !seen.includes(field)) seen.push(field);
    }
    for (const field of fields) {
      if (!seen.includes(field)) seen.push(field);
    }
    return seen;
  } catch {
    return fields;
  }
};

type IdFn = (part: string, slot?: unknown) => string;

/** Per-segment handlers, cached per bridge: the scope reads live through
 * proxies, so a cached closure never goes stale. */
interface SegmentHandlers {
  readonly onFocus: () => void;
  readonly onBlur: (event: FocusEvent) => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
  readonly onBeforeInput: (event: InputEvent) => void;
  readonly onPaste: (event: ClipboardEvent) => void;
}
const handlersByBridge = new WeakMap<IdFn, Map<number, SegmentHandlers>>();
const handlersFor = (scope: ScopeLike, index: number): SegmentHandlers => {
  let byIndex = handlersByBridge.get(scope.id);
  if (byIndex === undefined) {
    byIndex = new Map();
    handlersByBridge.set(scope.id, byIndex);
  }
  const hit = byIndex.get(index);
  if (hit !== undefined) return hit;
  const made: SegmentHandlers = {
    onFocus: (): void => scope.send({ type: "SEGMENT.FOCUS", index }),
    onBlur: (event: FocusEvent): void => {
      // Focus moving to another segment of this date is not a blur: the
      // machine would drop to idle and back on every arrow step.
      const target = event.relatedTarget;
      if (target instanceof Element && scope.root().contains(target)) return;
      scope.send({ type: "SEGMENT.BLUR" });
    },
    onKeyDown: (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      if (event.isComposing === true || event.keyCode === 229) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const key = event.key;
      if (key.length === 1) {
        // Printable characters flow through `beforeinput`, which carries
        // the composed text on mobile — but a keydown without one (a
        // test, a password manager) still types.
        return;
      }
      switch (key) {
        case "ArrowUp":
          event.preventDefault();
          scope.send({ type: "SEGMENT.ADJUST", index, amount: 1 });
          break;
        case "ArrowDown":
          event.preventDefault();
          scope.send({ type: "SEGMENT.ADJUST", index, amount: -1 });
          break;
        case "ArrowLeft":
          event.preventDefault();
          scope.send({ type: scope.props["dir"] === "rtl" ? "SEGMENT.ARROW_RIGHT" : "SEGMENT.ARROW_LEFT" });
          break;
        case "ArrowRight":
          event.preventDefault();
          scope.send({ type: scope.props["dir"] === "rtl" ? "SEGMENT.ARROW_LEFT" : "SEGMENT.ARROW_RIGHT" });
          break;
        case "Backspace":
          event.preventDefault();
          scope.send({ type: "SEGMENT.BACKSPACE" });
          break;
        case "Home":
          event.preventDefault();
          scope.send({ type: "SEGMENT.HOME" });
          break;
        case "End":
          event.preventDefault();
          scope.send({ type: "SEGMENT.END" });
          break;
      }
    },
    onBeforeInput: (event: InputEvent): void => {
      const data = (event as InputEvent & { data?: unknown }).data;
      if (typeof data !== "string" || data.length === 0) return;
      event.preventDefault();
      scope.send({ type: "SEGMENT.INPUT", index, input: data });
    },
    onPaste: (event: ClipboardEvent): void => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
      if (text.length > 0) scope.send({ type: "SEGMENT.PASTE", value: text });
    },
  };
  byIndex.set(index, made);
  return made;
};

/** Stable holders the for-rows close over: the text effect a row compiles
 * reads `row.text` off the render-time object, so a fresh object per read
 * would freeze every segment at its first text. Rewritten in place (like
 * the carousel readout); the array is fresh each read so the `for` still
 * syncs and bumps the rows. */
const holdersByBridge = new WeakMap<IdFn, Map<number, { text: string; placeholder: boolean }>>();
const holdersOf = (id: IdFn): Map<number, { text: string; placeholder: boolean }> => {
  let holders = holdersByBridge.get(id);
  if (holders === undefined) {
    holders = new Map();
    holdersByBridge.set(id, holders);
  }
  return holders;
};

const def: ComponentDef<DateInputContext, DateInputEvent> = {
  name: "date-input",
  config,
  implementations,
  seed: (props, authored) => {
    const granularity = props["granularity"] as DateGranularity;
    const hourCycle = props["hourCycle"] as 12 | 24;
    // A send first: the fork's initial context is the config's object
    // until a transition folds a copy, and two date inputs on a page
    // would otherwise share one context until the first keystroke. The
    // establish CLEAR below detaches it instead.
    void authored;
    return {
      granularity,
      hourCycle,
      min: props["min"] as string | null,
      max: props["max"] as string | null,
      fields: dateToFields(null, hourCycle),
      value: null,
      activeSegment: -1,
    };
  },
  establish: (props, authored) => {
    // Already parsed by the channels: `defaultValue` arrives as a value,
    // not the ISO string the host wrote.
    const seed = (authored("value") ? props["value"] : props["defaultValue"]) as DateValue | null;
    if (seed === null || seed === undefined) return [{ type: "VALUE.CLEAR" }];
    const min = props["min"] as string | null;
    const max = props["max"] as string | null;
    return [
      { type: "VALUE.CLEAR" },
      { type: "VALUE.SET", value: clampValue(seed, min, max) },
    ];
  },
  // The active segment moved → the segment it names takes DOM focus.
  settled: ({ before, after, focus }) => {
    const was = (before as unknown as Ctx).activeSegment;
    const at = (after as unknown as Ctx).activeSegment;
    if (at !== was && at >= 0) focus("segment", at);
  },
  mounted: ({ props, focus }) => {
    if (props["autoFocus"] === true) focus("segment", 0);
  },
  channels: {
    value: {
      controlled: true,
      parse: parseValue,
      nullable: true,
      event: (value: DateValue | null, context) => {
        const ctx = context as unknown as Ctx | undefined;
        return { type: "VALUE.SET", value: clampValue(value, ctx?.min ?? null, ctx?.max ?? null) };
      },
    },
    defaultValue: { parse: parseValue },
    granularity: {
      parse: (raw) => (raw === "hour" || raw === "minute" || raw === "second" ? raw : "day"),
    },
    hourCycle: { parse: (raw) => (raw === 24 ? 24 : 12) },
    min: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : null),
    },
    max: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : null),
    },
    label: { parse: (raw) => (typeof raw === "string" ? raw : "") },
    name: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : undefined),
    },
    form: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : undefined),
    },
    placeholder: { parse: (raw) => (typeof raw === "string" ? raw : "") },
    disabled: { parse: (raw) => raw === true },
    readOnly: { parse: (raw) => raw === true },
    invalid: { parse: (raw) => raw === true },
    required: { parse: (raw) => raw === true },
    dir: { parse: (raw) => (raw === "rtl" ? "rtl" : "ltr") },
    autoFocus: { parse: (raw) => raw === true },
  },
  scalars: ["granularity", "hourCycle", "min", "max"],
  reconcile: ({ context, parsed }) => {
    const ctx = asCtx(context);
    // An hour-cycle change rebuilds the fields the segments read.
    const hourCycle = parsed["hourCycle"] as 12 | 24;
    if (ctx.hourCycle !== hourCycle) {
      ctx.hourCycle = hourCycle;
      ctx.fields = dateToFields(ctx.value, hourCycle);
      return true;
    }
    return false;
  },
  parts: {
    segment: {
      sig: (scope, arg) => {
        const ctx = asCtx(scope.context);
        const index = arg as number;
        const granularity = (scope.props["granularity"] ?? ctx.granularity) as DateGranularity;
        const hourCycle = (scope.props["hourCycle"] ?? ctx.hourCycle) as 12 | 24;
        const field = orderFields(granularity, hourCycle)[index];
        return [
          index,
          field,
          field === undefined ? "" : ctx.fields[field],
          scope.state === "focused" && ctx.activeSegment === index,
          scope.props["disabled"],
          scope.props["readOnly"],
          scope.props["invalid"],
        ].join(" ");
      },
      attrs: (scope, arg) => {
        const ctx = asCtx(scope.context);
        const index = arg as number;
        const granularity = (scope.props["granularity"] ?? ctx.granularity) as DateGranularity;
        const hourCycle = (scope.props["hourCycle"] ?? ctx.hourCycle) as 12 | 24;
        const field = orderFields(granularity, hourCycle)[index];
        if (field === undefined) return {};
        const value = ctx.fields[field];
        const limits = FIELD_LIMITS[field];
        const maxDay = field === "day" ? daysInMonth(ctx.fields.year, ctx.fields.month) : limits.max;
        const editable = scope.props["disabled"] !== true && scope.props["readOnly"] !== true;
        return {
          id: scope.id("segment", index),
          role: "spinbutton",
          tabIndex: scope.props["disabled"] === true ? undefined : 0,
          "aria-label": FIELD_LABELS[field],
          "aria-valuenow": value ?? undefined,
          "aria-valuetext": value === null ? placeholderFor(field) : segmentText(field, value, hourCycle),
          "aria-valuemin": limits.min,
          "aria-valuemax": field === "day" ? maxDay : limits.max,
          "aria-invalid": scope.props["invalid"] === true ? true : undefined,
          "aria-readonly": scope.props["readOnly"] === true ? true : undefined,
          "aria-disabled": scope.props["disabled"] === true ? true : undefined,
          inputMode: field === "dayPeriod" ? undefined : "numeric",
          "data-type": field,
          "data-placeholder-shown": dataAttr(value === null),
          "data-disabled": dataAttr(scope.props["disabled"] === true),
          "data-focus": dataAttr(scope.state === "focused" && ctx.activeSegment === index),
          contentEditable: editable ? "true" : undefined,
          spellcheck: editable ? "false" : undefined,
          ...handlersFor(scope, index),
        };
      },
    },
    root: {
      sig: (scope) => [`${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id(""),
        dir: scope.props["dir"],
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    label: {
      sig: (scope) => [`${scope.props["label"]}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("label"),
        htmlFor: scope.id("segment", 0),
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    control: {
      sig: (scope) => [scope.state, `${scope.props["disabled"] === true}`].join(" "),
      attrs: (scope) => ({
        id: scope.id("control"),
        role: "group",
        "aria-labelledby": scope.id("label"),
        "data-focus": dataAttr(scope.state === "focused"),
        "data-disabled": dataAttr(scope.props["disabled"] === true),
      }),
    },
    hiddenInput: {
      id: "hidden",
      sig: (scope) => {
        const ctx = asCtx(scope.context);
        return [valueAsString(ctx.value), `${scope.props["name"]}`].join(" ");
      },
      attrs: (scope) => {
        const ctx = asCtx(scope.context);
        return {
          id: scope.id("hiddenInput"),
          type: "hidden",
          name: scope.props["name"],
          form: scope.props["form"],
          disabled: scope.props["disabled"],
          value: valueAsString(ctx.value),
        };
      },
    },
  },
  commands: {
    focus: { view: ({ focus }) => focus("segment", 0) },
    setValue: {
      event: (args, context) => {
        const ctx = context as unknown as Ctx;
        return {
          type: "VALUE.SET",
          value: clampValue(args[0] as DateValue | null, ctx.min, ctx.max),
        };
      },
    },
    clearValue: { event: () => ({ type: "VALUE.CLEAR" }) },
  },
  readers: {
    value: { read: (context) => asCtx(context).value },
    valueAsString: { read: (context) => valueAsString(asCtx(context).value) },
    focused: { read: (_context, state) => state === "focused" },
  },
  methods: {
    getSegments: {
      call: (context, _state, _args, props, id) => {
        const ctx = context as unknown as Ctx;
        const granularity = (props["granularity"] ?? ctx.granularity) as DateGranularity;
        const hourCycle = (props["hourCycle"] ?? ctx.hourCycle) as 12 | 24;
        const ordered = orderFields(granularity, hourCycle);
        const holders = holdersOf(id as unknown as IdFn);
        const views: DateSegmentView[] = [];
        let fieldIndex = 0;
        for (const field of ordered) {
          if (views.length > 0) {
            views.push({ index: views.length, fieldIndex: -1, field: null, text: "/", placeholder: true });
          }
          const value = ctx.fields[field];
          const at = views.length;
          const holder = holders.get(at) ?? { text: "", placeholder: true };
          holder.text = segmentText(field, value, hourCycle);
          holder.placeholder = value === null;
          holders.set(at, holder);
          views.push({
            index: at,
            fieldIndex,
            field,
            get text(): string {
              return holders.get(at)?.text ?? "";
            },
            get placeholder(): boolean {
              return holders.get(at)?.placeholder ?? true;
            },
          });
          fieldIndex += 1;
        }
        return views;
      },
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [valueAsString(asCtx(context).value)],
      detail: (watched, _event, _props, context) => {
        const value = (context as unknown as Ctx | undefined)?.value ?? null;
        void watched;
        return {
          value,
          valueAsString: valueAsString(value),
        };
      },
    },
  },
};

export const dateInput = defineComponent<DateInputContext, DateInputEvent, DateInputApi>(def);
