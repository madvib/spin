/**
 * Date-input machine: the field values, the focused segment, and the keys
 * typed into it.
 *
 * The machine holds plain field records — year, month, day, hour, minute,
 * second, dayPeriod — and the view formats them with `Intl.DateTimeFormat`,
 * which decides the segment order for the locale. A date the fields cannot
 * express (era, time zone, non-Gregorian calendars) is out of scope; the
 * value the host reads is the ISO calendar date the fields name.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export type DateInputField = "year" | "month" | "day" | "hour" | "minute" | "second" | "dayPeriod";

/** One field's limits, for spinbutton aria and Home/End. */
export interface DateFieldLimits {
  readonly min: number;
  readonly max: number;
}

export const FIELD_LIMITS: Readonly<Record<DateInputField, DateFieldLimits>> = {
  year: { min: 1, max: 9999 },
  month: { min: 1, max: 12 },
  day: { min: 1, max: 31 },
  hour: { min: 1, max: 12 },
  minute: { min: 0, max: 59 },
  second: { min: 0, max: 59 },
  dayPeriod: { min: 0, max: 1 },
};

/** The month lengths a leap year moves; February is resolved by `isLeapYear`. */
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number | null, month: number | null): number {
  if (month === null || month < 1 || month > 12) return 31;
  if (month !== 2) return MONTH_LENGTHS[month - 1] ?? 31;
  if (year === null) return 29;
  return isLeapYear(year) ? 29 : 28;
}

export function clampField(
  field: DateInputField,
  value: number,
  year: number | null,
  month: number | null,
): number {
  if (field === "day") {
    const max = daysInMonth(year, month);
    return Math.min(Math.max(value, 1), max);
  }
  const limits = FIELD_LIMITS[field];
  return Math.min(Math.max(value, limits.min), limits.max);
}

export interface DateFields {
  year: number | null;
  month: number | null;
  day: number | null;
  hour: number | null;
  minute: number | null;
  second: number | null;
  /** 0 is AM, 1 is PM. */
  dayPeriod: number | null;
}

export const emptyFields = (): DateFields => ({
  year: null,
  month: null,
  day: null,
  hour: null,
  minute: null,
  second: null,
  dayPeriod: null,
});

export type DateGranularity = "day" | "hour" | "minute" | "second";

const GRANULARITY_FIELDS: Readonly<Record<DateGranularity, readonly DateInputField[]>> = {
  day: ["month", "day", "year"],
  hour: ["month", "day", "year", "hour", "dayPeriod"],
  minute: ["month", "day", "year", "hour", "minute", "dayPeriod"],
  second: ["month", "day", "year", "hour", "minute", "second", "dayPeriod"],
};

export interface DateValue {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

/** The machine holds one group; range mode is two date-inputs, not two groups. */
export interface DateInputContext {
  value: DateValue | null;
  fields: DateFields;
  activeSegment: number;
  enteredKeys: string;
  granularity: DateGranularity;
  hourCycle: 12 | 24;
  min: string | null;
  max: string | null;
}

export interface DateInputValueChange {
  readonly value: DateValue | null;
  readonly valueAsString: string;
}

export type DateInputEvent =
  | { type: "VALUE.SET"; value: DateValue | null | string }
  | { type: "VALUE.CLEAR" }
  | { type: "HOUR_CYCLE.SET"; hourCycle: 12 | 24 }
  | { type: "SEGMENT.FOCUS"; index: number }
  | { type: "SEGMENT.BLUR" }
  | { type: "SEGMENT.INPUT"; index: number; input: string }
  | { type: "SEGMENT.ADJUST"; index: number; amount: number }
  | { type: "SEGMENT.ARROW_LEFT" }
  | { type: "SEGMENT.ARROW_RIGHT" }
  | { type: "SEGMENT.BACKSPACE" }
  | { type: "SEGMENT.HOME" }
  | { type: "SEGMENT.END" }
  | { type: "SEGMENT.PASTE"; value: string };

const config = {
  id: "date-input",
  initial: "idle",
  context: {
    value: null as DateValue | null,
    fields: emptyFields(),
    activeSegment: -1,
    enteredKeys: "",
    granularity: "day" as DateGranularity,
    hourCycle: 12 as 12 | 24,
    min: null as string | null,
    max: null as string | null,
  },
  // The root tier, exactly as Zag: the value events work from every state,
  // so a host's command writes the value whether or not a segment holds focus.
  on: {
    "VALUE.SET": { actions: [{ assign: "setValue" }] },
    "VALUE.CLEAR": { actions: [{ assign: "clearValue" }] },
    "HOUR_CYCLE.SET": { actions: [{ assign: "setHourCycle" }] },
  },
  states: {
    idle: {
      on: {
        "SEGMENT.FOCUS": { target: "focused", actions: [{ assign: "setActiveSegment" }] },
      },
    },
    focused: {
      on: {
        // DOM focus catching up to an auto-advance must not discard keys
        // already typed into it — Zag's `isActiveSegmentFocus` guard.
        "SEGMENT.FOCUS": [
          { cond: "isActiveSegment", actions: [{ assign: "setActiveSegment" }] },
          { actions: [{ assign: "setActiveSegment" }, { assign: "clearEnteredKeys" }] },
        ],
        "SEGMENT.BLUR": { target: "idle", actions: [{ assign: "clearActiveSegment" }, { assign: "clearEnteredKeys" }, { assign: "confirmValue" }] },
        "SEGMENT.INPUT": { actions: [{ assign: "setSegmentValue" }] },
        "SEGMENT.ADJUST": { actions: [{ assign: "adjustSegmentValue" }, { assign: "clearEnteredKeys" }] },
        "SEGMENT.ARROW_LEFT": { actions: [{ assign: "setPrevSegment" }, { assign: "clearEnteredKeys" }] },
        "SEGMENT.ARROW_RIGHT": { actions: [{ assign: "setNextSegment" }, { assign: "clearEnteredKeys" }] },
        "SEGMENT.BACKSPACE": [
          { cond: "isActiveSegmentEmpty", actions: [{ assign: "setPrevSegment" }, { assign: "clearEnteredKeys" }] },
          { actions: [{ assign: "clearSegmentValue" }] },
        ],
        "SEGMENT.HOME": { actions: [{ assign: "setSegmentToLowest" }, { assign: "clearEnteredKeys" }] },
        "SEGMENT.END": { actions: [{ assign: "setSegmentToHighest" }, { assign: "clearEnteredKeys" }] },
        "SEGMENT.PASTE": { actions: [{ assign: "setPastedValue" }, { assign: "clearEnteredKeys" }] },
      },
    },
  },
};

/** The date-input's arguments: the values the host may set. */
export interface DateInputArgs {
  value?: string;
  granularity?: string;
  hourCycle?: number;
  min?: string;
  max?: string;
  defaultMax?: string;
}

const isGranularity = (raw: unknown): raw is DateGranularity =>
  raw === "day" || raw === "hour" || raw === "minute" || raw === "second";

const isHourCycle = (raw: unknown): raw is 12 | 24 => raw === 12 || raw === 24;

const asIso = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 ? raw : null;

export function initial(args: DateInputArgs, authored: (name: string) => boolean): DateInputContext {
  const written = (field: string): boolean =>
    authored(field) || authored(defaultTwin(field));
  const granularity = written("granularity")
    ? (isGranularity(args.granularity) ? args.granularity : "day")
    : "day";
  const hourCycle = written("hourCycle")
    ? (isHourCycle(args.hourCycle) ? args.hourCycle : 12)
    : 12;
  const min = written("min") ? asIso(args.min) : null;
  const max = written("max") ? asIso(args.max) : null;
  const value = written("value")
    ? clampValue(parseValue(args.value), min, max)
    : null;
  return {
    value,
    fields: dateToFields(value, hourCycle),
    activeSegment: -1,
    enteredKeys: "",
    granularity,
    hourCycle,
    min,
    max,
  };
}

export function parseValue(raw: unknown): DateValue | null {
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
}

export function segmentFields(granularity: DateGranularity): readonly DateInputField[] {
  return GRANULARITY_FIELDS[granularity] ?? GRANULARITY_FIELDS["day"];
}

export function valueAsString(value: DateValue | null): string {
  if (value === null) return "";
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function fieldsToDate(fields: DateFields, hourCycle: 12 | 24): DateValue | null {
  const { year, month, day } = fields;
  if (year === null || month === null || day === null) return null;
  let hour = fields.hour ?? 0;
  if (hourCycle === 12) {
    if (fields.dayPeriod === 1) hour = hour === 12 ? 12 : hour + 12;
    else hour = hour === 12 ? 0 : hour;
  }
  return { year, month, day, hour, minute: fields.minute ?? 0, second: fields.second ?? 0 };
}

export function dateToFields(value: DateValue | null, hourCycle: 12 | 24): DateFields {
  const fields = emptyFields();
  if (value === null) return fields;
  fields.year = value.year;
  fields.month = value.month;
  fields.day = value.day;
  if (hourCycle === 12) {
    const period = value.hour >= 12 ? 1 : 0;
    const twelve = value.hour % 12 === 0 ? 12 : value.hour % 12;
    fields.hour = twelve;
    fields.dayPeriod = period;
  } else {
    fields.hour = value.hour;
  }
  fields.minute = value.minute;
  fields.second = value.second;
  return fields;
}

function boundDay(bound: string | null): number | null {
  if (bound === null || bound.length === 0) return null;
  const time = Date.parse(bound);
  return Number.isNaN(time) ? null : time;
}

export function clampValue(value: DateValue | null, min: string | null, max: string | null): DateValue | null {
  if (value === null) return null;
  const day = Date.parse(valueAsString(value));
  const floor = boundDay(min);
  if (floor !== null && day < floor) {
    const at = new Date(floor);
    return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate(), hour: 0, minute: 0, second: 0 };
  }
  const ceiling = boundDay(max);
  if (ceiling !== null && day > ceiling) {
    const at = new Date(ceiling);
    return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate(), hour: 0, minute: 0, second: 0 };
  }
  return value;
}

/** How many digits a segment accumulates before it advances. */
function fieldWidth(field: DateInputField): number {
  switch (field) {
    case "year": return 4;
    case "dayPeriod": return 1;
    default: return 2;
  }
}

function periodOf(input: string): number | null {
  const letter = input.toLowerCase();
  if (letter === "a") return 0;
  if (letter === "p") return 1;
  return null;
}

const implementations = {
  conds: {
    isActiveSegment: (ctx: DateInputContext, e: DateInputEvent): boolean =>
      e.type === "SEGMENT.FOCUS" && e.index === ctx.activeSegment,
    isActiveSegmentEmpty: (ctx: DateInputContext): boolean => {
      if (ctx.enteredKeys !== "") return false;
      const fields = segmentFields(ctx.granularity);
      const field = fields[ctx.activeSegment];
      return field === undefined || ctx.fields[field] === null;
    },
  },
  assigns: {
    setValue: (ctx: DateInputContext, e: DateInputEvent): Partial<DateInputContext> => {
      if (e.type !== "VALUE.SET") return {};
      // A host's text that names the value the machine already holds is no
      // write at all: the segments keep what the user is typing.
      const named = typeof e.value === "string" ? parseValue(e.value) : e.value;
      if (typeof e.value === "string" && valueAsString(ctx.value) === valueAsString(named)) {
        return {};
      }
      const value = clampValue(named, ctx.min, ctx.max);
      return { value, fields: dateToFields(value, ctx.hourCycle), enteredKeys: "" };
    },
    setHourCycle: (ctx: DateInputContext, e: DateInputEvent): Partial<DateInputContext> => {
      if (e.type !== "HOUR_CYCLE.SET") return {};
      return { hourCycle: e.hourCycle, fields: dateToFields(ctx.value, e.hourCycle) };
    },
    clearValue: (): Partial<DateInputContext> => ({ value: null, fields: emptyFields(), enteredKeys: "" }),
    setActiveSegment: (_ctx: DateInputContext, e: DateInputEvent): Partial<DateInputContext> => {
      if (e.type !== "SEGMENT.FOCUS") return {};
      return { activeSegment: e.index };
    },
    clearActiveSegment: (): Partial<DateInputContext> => ({ activeSegment: -1 }),
    clearEnteredKeys: (): Partial<DateInputContext> => ({ enteredKeys: "" }),
    setSegmentValue: (ctx: DateInputContext, e: DateInputEvent): Partial<DateInputContext> => {
      if (e.type !== "SEGMENT.INPUT") return {};
      const fields = segmentFields(ctx.granularity);
      const field = fields[e.index];
      if (field === undefined) return {};
      if (field === "dayPeriod") {
        const period = periodOf(e.input);
        if (period === null) return {};
        return advance({ ...ctx.fields, dayPeriod: period }, ctx, e.index, fields);
      }
      if (!/^[0-9]$/.test(e.input)) return {};
      const width = fieldWidth(field);
      const keys = `${ctx.enteredKeys}${e.input}`.slice(-width);
      const numeric = Number.parseInt(keys, 10);
      if (Number.isNaN(numeric)) return {};
      const next = { ...ctx.fields, [field]: clampField(field, numeric, ctx.fields.year, ctx.fields.month) };
      if (keys.length < width) return { fields: next, enteredKeys: keys };
      // A leading zero never fills: "0" starts the number, it is not one.
      if (keys.length === width && keys.startsWith("0") && field !== "year") {
        const short = Number.parseInt(keys.slice(1), 10);
        if (!Number.isNaN(short)) return { fields: { ...next, [field]: short }, enteredKeys: keys };
      }
      return advance(next, ctx, e.index, fields);
    },
    /** Arrows cycle the field within its limits; the day follows its month. */
    adjustSegmentValue: (ctx: DateInputContext, e: DateInputEvent): Partial<DateInputContext> => {
      if (e.type !== "SEGMENT.ADJUST") return {};
      const fields = segmentFields(ctx.granularity);
      const field = fields[e.index];
      if (field === undefined) return {};
      const current = ctx.fields[field];
      const limits = FIELD_LIMITS[field];
      const at = current ?? (e.amount > 0 ? limits.max : limits.min);
      const span = limits.max - limits.min + 1;
      const cycled = limits.min + (((at - limits.min + e.amount) % span + span) % span);
      const next = { ...ctx.fields, [field]: clampField(field, cycled, ctx.fields.year, ctx.fields.month) };
      return commit(next, ctx);
    },
    setPrevSegment: (ctx: DateInputContext): Partial<DateInputContext> => ({
      activeSegment: Math.max(0, ctx.activeSegment - 1),
    }),
    setNextSegment: (ctx: DateInputContext): Partial<DateInputContext> => ({
      activeSegment: Math.min(segmentFields(ctx.granularity).length - 1, ctx.activeSegment + 1),
    }),
    clearSegmentValue: (ctx: DateInputContext): Partial<DateInputContext> => {
      const fields = segmentFields(ctx.granularity);
      const field = fields[ctx.activeSegment];
      if (field === undefined) return {};
      return commit({ ...ctx.fields, [field]: null }, ctx);
    },
    setSegmentToLowest: (ctx: DateInputContext): Partial<DateInputContext> => {
      const fields = segmentFields(ctx.granularity);
      const field = fields[ctx.activeSegment];
      if (field === undefined) return {};
      const value = field === "day" ? 1 : FIELD_LIMITS[field].min;
      return commit({ ...ctx.fields, [field]: clampField(field, value, ctx.fields.year, ctx.fields.month) }, ctx);
    },
    setSegmentToHighest: (ctx: DateInputContext): Partial<DateInputContext> => {
      const fields = segmentFields(ctx.granularity);
      const field = fields[ctx.activeSegment];
      if (field === undefined) return {};
      const value = field === "day" ? daysInMonth(ctx.fields.year, ctx.fields.month) : FIELD_LIMITS[field].max;
      return commit({ ...ctx.fields, [field]: clampField(field, value, ctx.fields.year, ctx.fields.month) }, ctx);
    },
    setPastedValue: (ctx: DateInputContext, e: DateInputEvent): Partial<DateInputContext> => {
      if (e.type !== "SEGMENT.PASTE") return {};
      const time = Date.parse(e.value);
      if (Number.isNaN(time)) return {};
      const at = new Date(time);
      const value: DateValue = {
        year: at.getUTCFullYear(),
        month: at.getUTCMonth() + 1,
        day: at.getUTCDate(),
        hour: 0,
        minute: 0,
        second: 0,
      };
      const clamped = clampValue(value, ctx.min, ctx.max);
      return { value: clamped, fields: dateToFields(clamped, ctx.hourCycle), enteredKeys: "" };
    },
    confirmValue: (ctx: DateInputContext): Partial<DateInputContext> => {
      const value = clampValue(fieldsToDate(ctx.fields, ctx.hourCycle), ctx.min, ctx.max);
      if (value === null) return {};
      return { value, fields: dateToFields(value, ctx.hourCycle) };
    },
  },
};

function commit(next: DateFields, ctx: DateInputContext): Partial<DateInputContext> {
  const value = clampValue(fieldsToDate(next, ctx.hourCycle), ctx.min, ctx.max);
  if (value === null) return { fields: next, enteredKeys: "" };
  return { fields: dateToFields(value, ctx.hourCycle), value, enteredKeys: "" };
}

/** A completed segment hands focus to the next one; the view moves the DOM focus. */
function advance(
  next: DateFields,
  ctx: DateInputContext,
  index: number,
  fields: readonly DateInputField[],
): Partial<DateInputContext> {
  const committed = commit(next, ctx);
  return { ...committed, activeSegment: Math.min(index + 1, fields.length - 1) };
}

export function dateInput(
  args: DateInputArgs = {},
  authored: (name: string) => boolean,
): Machine<DateInputContext, DateInputEvent> {
  return createMachine<DateInputContext, DateInputEvent>({
    ...config,
    ...implementations,
    context: initial(args, authored),
    fields: {
      value: { event: "VALUE.SET" },
      granularity: {},
      hourCycle: {},
      min: {},
      max: {},
    },
  });
}
