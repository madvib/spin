/**
 * Date-input machine: the field values, the focused segment, and the keys
 * typed into it.
 *
 * Zag's date-input is `idle`/`focused` with per-segment editing, and that
 * maps straight onto the fork: the root `on` carries the value events (a
 * host's imperative `setValue` and the controlled channel write the value
 * without knowing whether a segment holds focus), `idle` is the start, and
 * `focused` is per-segment editing.
 *
 * The calendars Zag builds on (`@internationalized/date`) stay out: the
 * machine holds plain field records — year, month, day, hour, minute,
 * second, dayPeriod — and the view formats them with `Intl.DateTimeFormat`,
 * which is what decides the segment order for the locale. A date the fields
 * cannot express (era, time zone, non-Gregorian calendars) is out of scope;
 * the value the host reads is the ISO calendar date the fields name.
 *
 * Nothing here touches the DOM. Focus moves, selection collapse, and the
 * live-region announcement are the view's job — the bridge reports the
 * transition and the connect performs the reflex. The typed-keys buffer
 * (`enteredKeys`) is context because the assigns read it: two digits in one
 * segment accumulate, and leaving the segment clears them.
 */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export type DateInputField = "year" | "month" | "day" | "hour" | "minute" | "second" | "dayPeriod";

/** One field's limits, for spinbutton aria and Home/End. */
export interface DateFieldLimits {
  readonly min: number;
  readonly max: number;
}

/** One field's limits, for spinbutton aria and Home/End. */
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

/** The days a month holds; February follows the year when it is known. */
export function daysInMonth(year: number | null, month: number | null): number {
  if (month === null || month < 1 || month > 12) return 31;
  if (month !== 2) return MONTH_LENGTHS[month - 1] ?? 31;
  if (year === null) return 29;
  return isLeapYear(year) ? 29 : 28;
}

/** A field value that fits its limits; day clamps to the month it lands in. */
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

/** The fields of one date, each null until the user types it. */
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

/** The segments the view renders for a date granularity. */
export type DateGranularity = "day" | "hour" | "minute" | "second";

const GRANULARITY_FIELDS: Readonly<Record<DateGranularity, readonly DateInputField[]>> = {
  day: ["month", "day", "year"],
  hour: ["month", "day", "year", "hour", "dayPeriod"],
  minute: ["month", "day", "year", "hour", "minute", "dayPeriod"],
  second: ["month", "day", "year", "hour", "minute", "second", "dayPeriod"],
};

/** An ISO calendar date, or null when no field is set yet. */
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
  /** The committed value, ISO fields; midnight when the date has no time. */
  value: DateValue | null;
  /** The fields the segments show; the value fills them on seed. */
  fields: DateFields;
  /** The segment the keyboard talks to; -1 when nothing holds focus. */
  activeSegment: number;
  /** Digits typed into the active segment, awaiting the next one or a leave. */
  enteredKeys: string;
  /** The granularity the assigns read; the bridge syncs it from scope. */
  granularity: DateGranularity;
  /** Twelve- or twenty-four-hour clock; the bridge syncs it from scope. */
  hourCycle: 12 | 24;
  /** The smallest date the value may name; null when unbounded. */
  min: string | null;
  /** The largest date the value may name; null when unbounded. */
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
  // which is what lets the host's commands and the controlled channel write
  // the value without knowing whether a segment holds focus.
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

/**
 * The date-input's arguments: the values the host may set.
 *
 * The names are the element's prop names — the machine is instantiated
 * with the element's prop bag and picks what it wants. The twin
 * (`defaultValue`) is resolved by the framework before the factory is
 * called, so the machine only ever sees the live value.
 */
export interface DateInputArgs {
  /** The date, as the host wrote it: an ISO string. */
  value?: string;
  /** The granularity the segments show. */
  granularity?: string;
  /** The clock: 12 or 24 hours. */
  hourCycle?: number;
  /** The smallest date the value may name. */
  min?: string;
  /** The largest date the value may name. */
  max?: string;
  defaultMax?: string;
}

const isGranularity = (raw: unknown): raw is DateGranularity =>
  raw === "day" || raw === "hour" || raw === "minute" || raw === "second";

const isHourCycle = (raw: unknown): raw is 12 | 24 => raw === 12 || raw === 24;

const asIso = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 ? raw : null;

/**
 * The machine's context: the bounds and the granularity name themselves,
 * and the value is the host's own ISO text, clamped to the bounds.
 */
export function initial(args: DateInputArgs, authored: (name: string) => boolean): DateInputContext {
  // A channel: the host's write, or the machine's own default. The twin
  // is the framework's convention — a host that wrote `defaultValue`
  // wrote the channel too — and the framework has already resolved it
  // into the argument.
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

/** An ISO date string parses to a value; anything else is not a value. */
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

/** The segment list for a granularity, in locale order. */
export function segmentFields(granularity: DateGranularity): readonly DateInputField[] {
  return GRANULARITY_FIELDS[granularity] ?? GRANULARITY_FIELDS["day"];
}

/** The ISO string the host reads; empty when the date is incomplete. */
export function valueAsString(value: DateValue | null): string {
  if (value === null) return "";
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** The date the fields name when all three are set; null until then. */
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

/** The fields a committed value shows; midnight reads back as an empty clock. */
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

/** A min/max bound as an ISO date string parses to its day count; unparseable is unbounded. */
function boundDay(bound: string | null): number | null {
  if (bound === null || bound.length === 0) return null;
  const time = Date.parse(bound);
  return Number.isNaN(time) ? null : time;
}

/** The value clamped to the min/max day bounds; null stays null. */
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

/** The digit width a segment accumulates before auto-advancing. */
function fieldWidth(field: DateInputField): number {
  switch (field) {
    case "year": return 4;
    case "dayPeriod": return 1;
    default: return 2;
  }
}

/** A dayPeriod letter names its half; anything else is not a period. */
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
      // The value arrives the way the host wrote it — the command's record,
      // or the prop's own ISO text — and the machine shapes it. A host's
      // text that names the value the machine already holds is no write
      // at all: the segments keep what the user is typing.
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
    /** Typing accumulates digits until the segment's width, then advances. */
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
      // A full segment advances; a partial one waits for the next digit.
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
    /** A pasted ISO date replaces the value; anything else is refused. */
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
    /** Blur commits the named date when every date segment holds a digit. */
    confirmValue: (ctx: DateInputContext): Partial<DateInputContext> => {
      const value = clampValue(fieldsToDate(ctx.fields, ctx.hourCycle), ctx.min, ctx.max);
      if (value === null) return {};
      return { value, fields: dateToFields(value, ctx.hourCycle) };
    },
  },
};

/** The value a field move commits when the date segments are all set. */
function commit(next: DateFields, ctx: DateInputContext): Partial<DateInputContext> {
  const value = clampValue(fieldsToDate(next, ctx.hourCycle), ctx.min, ctx.max);
  if (value === null) return { fields: next, enteredKeys: "" };
  return { fields: dateToFields(value, ctx.hourCycle), value, enteredKeys: "" };
}

/** A completed segment hands focus to the next one; the view moves it. */
function advance(
  next: DateFields,
  ctx: DateInputContext,
  index: number,
  fields: readonly DateInputField[],
): Partial<DateInputContext> {
  const committed = commit(next, ctx);
  return { ...committed, activeSegment: Math.min(index + 1, fields.length - 1) };
}

/**
 * The date-input machine: state and nothing else. It is headless — it
 * knows its own arguments, and nothing about props, markup, or the DOM.
 */
export function dateInput(
  args: DateInputArgs = {},
  authored: (name: string) => boolean,
): Machine<DateInputContext, DateInputEvent> {
  return createMachine<DateInputContext, DateInputEvent>({
    ...config,
    ...implementations,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries.
     *
     * A field with an event is REPORTED: the host's write is an event,
     * the machine decides, and the change reaches the host. A field
     * without one is SILENT: the host's write lands in the field, and
     * nothing reports.
     */
    fields: {
      value: { event: "VALUE.SET" },
      granularity: {},
      hourCycle: {},
      min: {},
      max: {},
    },
  });
}
