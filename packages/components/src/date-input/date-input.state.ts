import { defaultTwin } from "@spin/runtime";
import type { DateInputEvent } from "./date-input.events.ts";

export type DateInputField =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "dayPeriod";

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

const GRANULARITY_FIELDS: Readonly<
  Record<DateGranularity, readonly DateInputField[]>
> = {
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

export interface DateInputContext {
  value: DateValue | null;
  fields: DateFields;
  activeSegment: number;
  enteredKeys: string;
  granularity: DateGranularity;
  hourCycle: 12 | 24;
  min: string | null;
  max: string | null;
  dir: "ltr" | "rtl";
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean | undefined;
  required: boolean;
  name: string | undefined;
  form: string | undefined;
}
export type DateInputState = "idle" | "focused";

export interface DateInputArgs {
  value?: string;
  granularity?: string;
  hourCycle?: number;
  min?: string;
  max?: string;
  defaultMax?: string;
  dir?: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  required?: boolean;
  name?: string;
  form?: string;
}

const isGranularity = (raw: unknown): raw is DateGranularity =>
  raw === "day" || raw === "hour" || raw === "minute" || raw === "second";

const isHourCycle = (raw: unknown): raw is 12 | 24 => raw === 12 || raw === 24;

const asIso = (raw: unknown): string | null =>
  typeof raw === "string" && raw.length > 0 ? raw : null;

export function initial(
  args: DateInputArgs,
  authored: (name: string) => boolean,
): DateInputContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
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
    dir: args.dir === "rtl" ? "rtl" : "ltr",
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    invalid: authored("invalid") ? args.invalid === true : undefined,
    required: args.required === true,
    name: typeof args.name === "string" && args.name.length > 0
      ? args.name
      : undefined,
    form: typeof args.form === "string" && args.form.length > 0
      ? args.form
      : undefined,
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

export function segmentFields(
  granularity: DateGranularity,
): readonly DateInputField[] {
  return GRANULARITY_FIELDS[granularity] ?? GRANULARITY_FIELDS["day"];
}

export function valueAsString(value: DateValue | null): string {
  if (value === null) return "";
  const date = new Date(
    Date.UTC(
      value.year,
      value.month - 1,
      value.day,
      value.hour,
      value.minute,
      value.second,
    ),
  );
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function fieldsToDate(
  fields: DateFields,
  hourCycle: 12 | 24,
): DateValue | null {
  const { year, month, day } = fields;
  if (year === null || month === null || day === null) return null;
  let hour = fields.hour ?? 0;
  if (hourCycle === 12) {
    if (fields.dayPeriod === 1) hour = hour === 12 ? 12 : hour + 12;
    else hour = hour === 12 ? 0 : hour;
  }
  return {
    year,
    month,
    day,
    hour,
    minute: fields.minute ?? 0,
    second: fields.second ?? 0,
  };
}

export function dateToFields(
  value: DateValue | null,
  hourCycle: 12 | 24,
): DateFields {
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

export function clampValue(
  value: DateValue | null,
  min: string | null,
  max: string | null,
): DateValue | null {
  if (value === null) return null;
  const day = Date.parse(valueAsString(value));
  const floor = boundDay(min);
  if (floor !== null && day < floor) {
    const at = new Date(floor);
    return {
      year: at.getUTCFullYear(),
      month: at.getUTCMonth() + 1,
      day: at.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    };
  }
  const ceiling = boundDay(max);
  if (ceiling !== null && day > ceiling) {
    const at = new Date(ceiling);
    return {
      year: at.getUTCFullYear(),
      month: at.getUTCMonth() + 1,
      day: at.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    };
  }
  return value;
}

export function fieldWidth(field: DateInputField): number {
  switch (field) {
    case "year":
      return 4;
    case "dayPeriod":
      return 1;
    default:
      return 2;
  }
}

export function periodOf(input: string): number | null {
  const letter = input.toLowerCase();
  if (letter === "a") return 0;
  if (letter === "p") return 1;
  return null;
}

export function commit(
  next: DateFields,
  ctx: DateInputContext,
): Partial<DateInputContext> {
  const value = clampValue(fieldsToDate(next, ctx.hourCycle), ctx.min, ctx.max);
  if (value === null) return { fields: next, enteredKeys: "" };
  return { fields: dateToFields(value, ctx.hourCycle), value, enteredKeys: "" };
}

export function advance(
  next: DateFields,
  ctx: DateInputContext,
  index: number,
  fields: readonly DateInputField[],
): Partial<DateInputContext> {
  const committed = commit(next, ctx);
  return {
    ...committed,
    activeSegment: Math.min(index + 1, fields.length - 1),
  };
}

// transitions helpers exported? setActiveSegment etc move to transitions.
export const setActiveSegment = (
  _ctx: DateInputContext,
  e: DateInputEvent,
): Partial<DateInputContext> => {
  if (e.type !== "SEGMENT.FOCUS") return {};
  return { activeSegment: e.index };
};

export const clearEnteredKeys = (): Partial<DateInputContext> => ({
  enteredKeys: "",
});
export const setPrevSegment = (
  ctx: DateInputContext,
): Partial<DateInputContext> => ({
  activeSegment: Math.max(0, ctx.activeSegment - 1),
});
