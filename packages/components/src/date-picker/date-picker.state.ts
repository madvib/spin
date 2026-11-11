import { defaultTwin, isRecord } from "@spinjs/components/runtime";

export type DatePickerState = "idle" | "focused" | "open";

export type DatePickerView = "day" | "month" | "year";
export type DatePickerSelectionMode = "single" | "multiple" | "range";

export interface DatePickerValue {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface DatePickerContext {
  value: DatePickerValue[];
  focusedValue: DatePickerValue;
  hoveredValue: DatePickerValue | null;
  activeIndex: number;
  view: DatePickerView;
  selectionMode: DatePickerSelectionMode;
  numOfMonths: number;
  startValue: DatePickerValue | null;
  min: string | null;
  max: string | null;
  closeOnSelect: boolean;
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean;
  startOfWeek: number;
  dir: "ltr" | "rtl";
  label: string;
  locale: string;
  placeholder: string;
  format: ((value: DatePickerValue, locale: string) => string) | undefined;
}

export interface DatePickerArgs {
  value?: string;
  focusedValue?: string;
  view?: string;
  selectionMode?: string;
  numOfMonths?: number;
  min?: string;
  max?: string;
  closeOnSelect?: boolean;
  defaultCloseOnSelect?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  startOfWeek?: number;
  dir?: string;
  label?: string;
  locale?: string;
  placeholder?: string;
  format?: ((value: DatePickerValue, locale: string) => string) | undefined;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 31;
  if (month !== 2) return MONTH_LENGTHS[month - 1] ?? 31;
  return isLeapYear(year) ? 29 : 28;
}

const dayOf = (value: DatePickerValue): number =>
  Date.parse(`${iso(value)}T00:00:00Z`);

const iso = (value: DatePickerValue): string =>
  `${`${value.year}`.padStart(4, "0")}-${`${value.month}`.padStart(2, "0")}-${
    `${value.day}`.padStart(2, "0")
  }`;

export function sortKey(value: DatePickerValue): number {
  const time = dayOf(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

export function parseDay(raw: unknown): DatePickerValue | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const time = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  const at = new Date(time);
  return {
    year: at.getUTCFullYear(),
    month: at.getUTCMonth() + 1,
    day: at.getUTCDate(),
  };
}

export function dayRecord(raw: unknown): DatePickerValue | null {
  if (typeof raw === "string") return parseDay(raw);
  if (!isRecord(raw)) return null;
  const year = raw["year"];
  const month = raw["month"];
  const day = raw["day"];
  if (
    typeof year !== "number" || !Number.isFinite(year) ||
    typeof month !== "number" || !Number.isFinite(month) ||
    typeof day !== "number" || !Number.isFinite(day)
  ) return null;
  return { year, month, day };
}

export function parseDays(raw: unknown): DatePickerValue[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const days: DatePickerValue[] = [];
      for (const entry of parsed) {
        const day = parseDay(entry);
        if (day !== null) days.push(day);
      }
      return days;
    } catch {
      return [];
    }
  }
  const day = parseDay(raw);
  return day === null ? [] : [day];
}

export function daysOf(raw: unknown): DatePickerValue[] {
  if (!Array.isArray(raw)) return parseDays(raw);
  const days: DatePickerValue[] = [];
  for (const entry of raw) {
    const day = dayRecord(entry);
    if (day !== null) days.push(day);
  }
  return days;
}

export function viewOf(raw: unknown): DatePickerView {
  return raw === "month" || raw === "year" ? raw : "day";
}

export function initial(
  args: DatePickerArgs = {},
  authored: (name: string) => boolean,
): DatePickerContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const mode: unknown = args.selectionMode;
  const count: unknown = args.numOfMonths;
  const text = (value: unknown): string | null =>
    typeof value === "string" && value.length > 0 ? value : null;
  const min = written("min") ? text(args.min) : null;
  const max = written("max") ? text(args.max) : null;
  const parsed = written("value") ? daysOf(args.value) : [];
  const value = normalizeDays(parsed, min, max);
  const now = new Date();
  const today: DatePickerValue = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
  const focused =
    (written("focusedValue") ? dayRecord(args.focusedValue) : null) ??
      parsed[0] ?? today;
  const startOfWeek =
    typeof args.startOfWeek === "number" && args.startOfWeek >= 0 &&
      args.startOfWeek <= 6
      ? Math.trunc(args.startOfWeek)
      : 0;
  return {
    value,
    focusedValue: clampDay(focused, min, max),
    hoveredValue: null,
    activeIndex: 0,
    view: written("view") ? viewOf(args.view) : "day",
    selectionMode:
      written("selectionMode") && (mode === "multiple" || mode === "range")
        ? mode
        : "single",
    numOfMonths: written("numOfMonths") && typeof count === "number" &&
        Number.isFinite(count)
      ? count
      : 1,
    startValue: value.length > 0 ? value[0] ?? null : null,
    min,
    max,
    closeOnSelect: written("closeOnSelect")
      ? args.closeOnSelect !== false
      : true,
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    invalid: args.invalid === true,
    startOfWeek,
    dir: args.dir === "rtl" ? "rtl" : "ltr",
    label: typeof args.label === "string" && args.label.length > 0
      ? args.label
      : "Date",
    locale: typeof args.locale === "string" && args.locale.length > 0
      ? args.locale
      : "en-US",
    placeholder:
      typeof args.placeholder === "string" && args.placeholder.length > 0
        ? args.placeholder
        : "Pick a date",
    format: typeof args.format === "function"
      ? args.format as (value: DatePickerValue, locale: string) => string
      : undefined,
  };
}

export function dayAsString(value: DatePickerValue): string {
  return iso(value);
}

export function valueAsAllStrings(value: readonly DatePickerValue[]): string[] {
  return value.map(dayAsString);
}

export const sameDay = (a: DatePickerValue, b: DatePickerValue): boolean =>
  iso(a) === iso(b);

export function clampDay(
  value: DatePickerValue,
  min: string | null,
  max: string | null,
): DatePickerValue {
  const day = Math.min(
    Math.max(value.day, 1),
    daysInMonth(value.year, value.month),
  );
  let at: DatePickerValue = { ...value, day };
  const time = dayOf(at);
  const floor = boundDay(min);
  const ceiling = boundDay(max);
  if (floor !== null && time < floor) at = fromDayIndex(floor);
  if (ceiling !== null && time > ceiling) at = fromDayIndex(ceiling);
  return at;
}

function boundDay(bound: string | null): number | null {
  if (bound === null || bound.length === 0) return null;
  const time = Date.parse(`${bound}T00:00:00Z`);
  return Number.isNaN(time) ? null : time;
}

function fromDayIndex(time: number): DatePickerValue {
  const at = new Date(time);
  return {
    year: at.getUTCFullYear(),
    month: at.getUTCMonth() + 1,
    day: at.getUTCDate(),
  };
}

export const inBounds = (
  value: DatePickerValue,
  min: string | null,
  max: string | null,
): boolean => {
  const time = dayOf(value);
  const floor = boundDay(min);
  const ceiling = boundDay(max);
  return (floor === null || time >= floor) &&
    (ceiling === null || time <= ceiling);
};

export function normalizeDays(
  days: readonly DatePickerValue[],
  min: string | null,
  max: string | null,
): DatePickerValue[] {
  const seen = new Set<string>();
  const out: DatePickerValue[] = [];
  for (const day of days) {
    const at = clampDay(day, min, max);
    if (!inBounds(at, min, max)) continue;
    if (seen.has(iso(at))) continue;
    seen.add(iso(at));
    out.push(at);
  }
  return out.sort((a, b) => sortKey(a) - sortKey(b));
}
