import {
  type ApiOf,
  ariaDisabled,
  ariaInvalid,
  ariaLabelledBy,
  ariaReadOnly,
  type ComponentDef,
  dataAttr,
  defineComponent,
  isRecord,
  type ViewFor,
  sliderThumb,
  type SlotViewFor,
} from "@spinjs/runtime";
import {
  clampValue,
  type DateGranularity,
  type DateInputArgs,
  type DateInputContext,
  type DateInputField,
  type DateInputState,
  type DateValue,
  daysInMonth,
  FIELD_LIMITS,
  segmentFields,
  valueAsString,
} from "./date-input.state.ts";
import type { DateInputEvents } from "./date-input.events.ts";
import type { DateInputValueChange } from "./date-input.events.ts";
import { dateInput as dateInputMachine } from "./date-input.machine.ts";
/**
 * Date-input definition: the DOM contract as data.
 *
 * Segments render through `Intl.DateTimeFormat.formatToParts`, which
 * decides the order for the locale — month-first in en-US, day-first in
 * en-GB. The machine's segment list (`segmentFields`) is the canonical
 * order; the view maps each formatted part back to its field.
 */

export type { DateInputValueChange, DateValue };

/** One rendered segment: a field the user edits, or a literal between them. */
export interface DateSegmentView {
  readonly index: number;
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

export const segmentText = (
  field: DateInputField,
  value: number | null,
  hourCycle: 12 | 24,
): string => {
  if (value === null) return placeholderFor(field);
  switch (field) {
    case "year":
      return `${value}`.padStart(4, "0");
    case "dayPeriod":
      return value === 1 ? "PM" : "AM";
    case "hour":
      return hourCycle === 12
        ? `${value}`
        : value < 10
        ? `0${value}`
        : `${value}`;
    default:
      return value < 10 ? `0${value}` : `${value}`;
  }
};

const placeholderFor = (field: DateInputField): string => {
  switch (field) {
    case "year":
      return "yyyy";
    case "month":
      return "mm";
    case "day":
      return "dd";
    case "hour":
      return "hh";
    case "minute":
      return "mm";
    case "second":
      return "ss";
    case "dayPeriod":
      return "AM/PM";
  }
};

type ScopeLike = ViewFor<DateInputContext, DateInputEvents, DateInputState>;
type SlotLike<R> = SlotViewFor<
  R,
  DateInputContext,
  DateInputEvents,
  DateInputState
>;

const partToField = (
  type: string,
  hourCycle: 12 | 24,
): DateInputField | null => {
  switch (type) {
    case "year":
      return "year";
    case "month":
      return "month";
    case "day":
      return "day";
    case "hour":
      return "hour";
    case "minute":
      return "minute";
    case "second":
      return "second";
    case "dayPeriod":
      return hourCycle === 12 ? "dayPeriod" : null;
    default:
      return null;
  }
};

/** The formatter is the locale's segment order: format a known date and
 * read the parts back. January 22 gives every part a distinct shape, so
 * each part maps to exactly one field. */
const orderFields = (
  granularity: DateGranularity,
  hourCycle: 12 | 24,
): readonly DateInputField[] => {
  const fields = segmentFields(granularity);
  try {
    const probe = new Date(Date.UTC(2024, 0, 22, 13, 44, 55));
    const parts = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      ...(fields.includes("hour")
        ? { hour: "numeric", hour12: hourCycle === 12 }
        : {}),
      ...(fields.includes("minute") ? { minute: "2-digit" } : {}),
      ...(fields.includes("second") ? { second: "2-digit" } : {}),
      timeZone: "UTC",
    }).formatToParts(probe);
    const seen: DateInputField[] = [];
    for (const part of parts) {
      const field = partToField(part.type, hourCycle);
      if (field !== null && fields.includes(field) && !seen.includes(field)) {
        seen.push(field);
      }
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
        // the composed text on mobile; a keydown without one still types.
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
          scope.send({
            type: scope.context.dir === "rtl"
              ? "SEGMENT.ARROW_RIGHT"
              : "SEGMENT.ARROW_LEFT",
          });
          break;
        case "ArrowRight":
          event.preventDefault();
          scope.send({
            type: scope.context.dir === "rtl"
              ? "SEGMENT.ARROW_LEFT"
              : "SEGMENT.ARROW_RIGHT",
          });
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
      // `data` is on the spec but missing from lib.dom's InputEvent.
      const data: unknown = "data" in event ? event.data : undefined;
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

const isDateValue = (raw: unknown): raw is DateValue => {
  if (!isRecord(raw)) return false;
  return ["year", "month", "day", "hour", "minute", "second"].every((key) => {
    const field: unknown = raw[key];
    return typeof field === "number" && Number.isFinite(field);
  });
};

const isIdFn = (id: unknown): id is IdFn => typeof id === "function";

const fallbackId: IdFn = () => "";

const segmentIndexOf = (arg: unknown): number =>
  typeof arg === "number" && Number.isInteger(arg) && arg >= 0 ? arg : -1;

/** Stable holders the for-rows close over: the text effect a row compiles
 * reads `row.text` off the render-time object, so a fresh object per read
 * would freeze every segment at its first text. Rewritten in place; the
 * array is fresh each read so the `for` still syncs and bumps the rows. */
const holdersByBridge = new WeakMap<
  IdFn,
  Map<number, { text: string; placeholder: boolean }>
>();
const holdersOf = (
  id: IdFn,
): Map<number, { text: string; placeholder: boolean }> => {
  let holders = holdersByBridge.get(id);
  if (holders === undefined) {
    holders = new Map();
    holdersByBridge.set(id, holders);
  }
  return holders;
};

/** The component's public state: the names the markup may key on. */
export const def = {
  name: "date-input",
  machine: (args: DateInputArgs, authored) => dateInputMachine(args, authored),
  start: "idle",
  settled: ({ before, after, focus }) => {
    const was = before.context.activeSegment;
    const at = after.context.activeSegment;
    if (at !== was && at >= 0) focus("segment", at);
  },
  parts: {
    segment: {
      attrs: (scope: ScopeLike, arg?: unknown) => {
        const ctx = scope.context;
        const index = segmentIndexOf(arg);
        const granularity = ctx.granularity;
        const hourCycle = ctx.hourCycle;
        const field = orderFields(granularity, hourCycle)[index];
        if (field === undefined) return {};
        const value = ctx.fields[field];
        const limits = FIELD_LIMITS[field];
        const maxDay = field === "day"
          ? daysInMonth(ctx.fields.year, ctx.fields.month)
          : limits.max;
        const editable = !scope.context.disabled && !scope.context.readOnly;
        return {
          id: scope.id("segment", index),
          role: "spinbutton",
          tabIndex: scope.context.disabled ? undefined : 0,
          "aria-label": FIELD_LABELS[field],
          ...sliderThumb({
            now: value ?? undefined,
            text: value === null
              ? placeholderFor(field)
              : segmentText(field, value, hourCycle),
            min: limits.min,
            max: field === "day" ? maxDay : limits.max,
          }),
          ...ariaInvalid(scope.context.invalid === true ? true : undefined),
          ...ariaReadOnly(scope.context.readOnly === true ? true : undefined),
          ...ariaDisabled(scope.context.disabled === true ? true : undefined),
          inputMode: field === "dayPeriod" ? undefined : "numeric",
          contentEditable: editable ? "true" : undefined,
          spellcheck: editable ? "false" : undefined,
          ...handlersFor(scope, index),
        };
      },
    },
    root: {
      attrs: (scope: ScopeLike) => ({
        dir: scope.context.dir,
      }),
    },
    label: {
      attrs: (scope: ScopeLike) => ({
        id: scope.id("label"),
        htmlFor: scope.id("segment", 0),
      }),
    },
    control: {
      attrs: (scope: ScopeLike) => ({
        role: "group",
        ...ariaLabelledBy(scope, { part: "label" }),
      }),
    },
    hiddenInput: {
      id: "hidden",
      attrs: (scope: ScopeLike) => {
        const ctx = scope.context;
        return {
          type: "hidden",
          name: ctx.name,
          form: ctx.form,
          disabled: ctx.disabled,
          value: valueAsString(ctx.value),
        };
      },
    },
  },
  commands: {
    focus: {
      view: ({ focus }: {
        readonly args: readonly unknown[];
        readonly id: (part: string, slot?: unknown) => string;
        readonly focus: (part: string, slot?: unknown) => void;
        readonly measure: (part: string, slot?: unknown) => DOMRect | null;
        readonly root: () => Element;
      }) => focus("segment", 0),
    },
    setValue: {
      event: (
        [value]: [value: DateValue | null],
        context: DateInputContext,
      ) => {
        const shaped = isDateValue(value) ? value : null;
        return {
          type: "VALUE.SET",
          value: clampValue(shaped, context.min, context.max),
        };
      },
    },
    clearValue: { event: () => ({ type: "VALUE.CLEAR" }) },
  },
  readers: {
    value: { read: (context) => context.value },
    valueAsString: { read: (context) => valueAsString(context.value) },
    focused: { read: (_context, state) => state === "focused" },
    activeSegment: {
      read: (context, state) => state === "focused" ? context.activeSegment : -1,
    },
    disabled: { read: (context) => context.disabled },
    readOnly: { read: (context) => context.readOnly },
    invalid: { read: (context) => context.invalid === true },
  },
  methods: {
    getSegments: {
      call: (context: DateInputContext, _state, _args, props, id) => {
        const ctx = context;
        const granularity = ctx.granularity;
        const hourCycle = ctx.hourCycle;
        const ordered = orderFields(granularity, hourCycle);
        const holders = holdersOf(isIdFn(id) ? id : fallbackId);
        const views: DateSegmentView[] = [];
        let fieldIndex = 0;
        for (const field of ordered) {
          if (views.length > 0) {
            views.push({
              index: views.length,
              fieldIndex: -1,
              field: null,
              text: "/",
              placeholder: true,
            });
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
      watch: (context) => [valueAsString(context.value)],
      detail: (_watched, _event, _props, context: DateInputContext) => ({
        value: context.value,
        valueAsString: valueAsString(context.value),
      }),
    },
  },
} satisfies ComponentDef<
  DateInputContext,
  DateInputEvents,
  Record<string, unknown>,
  DateInputArgs,
  DateInputState
>;

export type DateInputApi = ApiOf<typeof def>;
export const dateInput = defineComponent<
  DateInputContext,
  DateInputEvents,
  DateInputApi,
  DateInputArgs,
  DateInputState
>(def);
