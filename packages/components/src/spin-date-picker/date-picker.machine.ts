/**
 * Date-picker machine: the open/closed modes, the view mode (day, month,
 * year), and the three selection modes' value moves.
 *
 * Zag's date-picker is `idle`/`focused` (closed) and `open`, with the view
 * held in context because the legal meaning of a cell click differs per
 * view — exactly the fork's shape. The calendar math (a weekday grid, a
 * month's length, the next page) is the view's job per the corpus rule:
 * the connect computes the target date from the visible grid and sends
 * `FOCUS.SET`; this machine constrains it and moves it. Nothing here walks
 * a collection or a DOM.
 *
 * The calendars Zag depends on (`@internationalized/date`) stay out. The
 * machine holds plain ISO day records, and a date the records cannot
 * express (era, time zone, non-Gregorian calendars) is out of scope.
 */

import { defaultTwin, isRecord } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

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
}

export interface DatePickerValueChange {
  readonly value: readonly DatePickerValue[];
  readonly valueAsString: readonly string[];
}

export interface DatePickerFocusChange {
  readonly focusedValue: DatePickerValue;
  readonly view: DatePickerView;
  readonly valueAsString: readonly string[];
}

export interface DatePickerViewChange {
  readonly view: DatePickerView;
}

export type DatePickerEvent =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "CLOSE.OUTSIDE" }
  /** The selection: the days themselves, or the ISO text a host wrote. */
  | { type: "VALUE.SET"; value: readonly DatePickerValue[] | string }
  | { type: "VALUE.CLEAR" }
  /** The focused day: the day itself, or the ISO text a host wrote. */
  | { type: "FOCUS.SET"; focusedValue: DatePickerValue | string }
  | { type: "VIEW.SET"; view: DatePickerView }
  | { type: "CELL.CLICK"; value: DatePickerValue }
  | { type: "CELL.POINTER_MOVE"; value: DatePickerValue }
  | { type: "TABLE.POINTER_LEAVE" }
  | { type: "TABLE.ENTER"; value: DatePickerValue }
  | { type: "TABLE.ESCAPE" };

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 31;
  if (month !== 2) return MONTH_LENGTHS[month - 1] ?? 31;
  return isLeapYear(year) ? 29 : 28;
}

const dayOf = (value: DatePickerValue): number => Date.parse(`${iso(value)}T00:00:00Z`);

const iso = (value: DatePickerValue): string =>
  `${`${value.year}`.padStart(4, "0")}-${`${value.month}`.padStart(2, "0")}-${`${value.day}`.padStart(2, "0")}`;

/** A day's index for sorting and range spans; invalid dates sort first. */
function sortKey(value: DatePickerValue): number {
  const time = dayOf(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

export function parseDay(raw: unknown): DatePickerValue | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const time = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  const at = new Date(time);
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
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

/**
 * The date-picker's arguments: the values the host may set. The twins
 * (`defaultValue`, `defaultFocusedValue`) are resolved by the framework
 * before the factory is called, so the machine only ever sees the live
 * values.
 */
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
}

export function initial(args: DatePickerArgs = {}, authored: (name: string) => boolean): DatePickerContext {
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
  // The parsed days seed the focus; the normalized ones are the selection.
  const parsed = written("value") ? daysOf(args.value) : [];
  const value = normalizeDays(parsed, min, max);
  const now = new Date();
  const today: DatePickerValue = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
  const focused = (written("focusedValue") ? dayRecord(args.focusedValue) : null) ??
    parsed[0] ?? today;
  return {
    value,
    focusedValue: clampDay(focused, min, max),
    hoveredValue: null,
    activeIndex: 0,
    view: written("view") ? viewOf(args.view) : "day",
    selectionMode: written("selectionMode") && (mode === "multiple" || mode === "range")
      ? mode
      : "single",
    numOfMonths: written("numOfMonths") && typeof count === "number" &&
        Number.isFinite(count)
      ? count
      : 1,
    startValue: value.length > 0 ? value[0] ?? null : null,
    min,
    max,
    closeOnSelect: written("closeOnSelect") ? args.closeOnSelect !== false : true,
  };
}

export function dayAsString(value: DatePickerValue): string {
  return iso(value);
}

export function valueAsAllStrings(value: readonly DatePickerValue[]): string[] {
  return value.map(dayAsString);
}

const sameDay = (a: DatePickerValue, b: DatePickerValue): boolean => iso(a) === iso(b);

export function clampDay(
  value: DatePickerValue,
  min: string | null,
  max: string | null,
): DatePickerValue {
  const day = Math.min(Math.max(value.day, 1), daysInMonth(value.year, value.month));
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
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
}

const inBounds = (value: DatePickerValue, min: string | null, max: string | null): boolean => {
  const time = dayOf(value);
  const floor = boundDay(min);
  const ceiling = boundDay(max);
  return (floor === null || time >= floor) && (ceiling === null || time <= ceiling);
};

const config = {
  id: "date-picker",
  initial: "idle",
  context: {
    value: [] as DatePickerValue[],
    focusedValue: { year: 2024, month: 1, day: 1 } as DatePickerValue,
    hoveredValue: null as DatePickerValue | null,
    activeIndex: 0,
    view: "day" as DatePickerView,
    selectionMode: "single" as DatePickerSelectionMode,
    numOfMonths: 1,
    startValue: null as DatePickerValue | null,
    min: null as string | null,
    max: null as string | null,
    closeOnSelect: true,
  },
  // Root tier: the value moves work from every state, so the host's
  // commands write the selection without knowing whether the panel is open.
  on: {
    "VALUE.SET": { actions: [{ assign: "setValue" }] },
    "VALUE.CLEAR": { actions: [{ assign: "clearValue" }] },
    "FOCUS.SET": [
      { cond: "isDayView", actions: [{ assign: "setFocusedValue" }] },
      { actions: [{ assign: "moveFocusedValue" }] },
    ],
    "VIEW.SET": [{ actions: [{ assign: "setView" }] }],
  },
  states: {
    idle: {
      on: {
        "OPEN": [{ target: "open", actions: [{ assign: "resetView" }] }],
      },
    },
    focused: {
      on: {
        "OPEN": [{ target: "open", actions: [{ assign: "resetView" }] }],
      },
    },
    open: {
      on: {
        "CLOSE": [{ target: "focused" }],
        "CLOSE.OUTSIDE": [{ target: "idle" }],
        "CELL.CLICK": [
          { cond: "isAboveDayView", actions: [{ assign: "drillIntoView" }] },
          { cond: "isRangePicker", actions: [{ assign: "selectRangeDay" }] },
          { cond: "isMultiPicker", actions: [{ assign: "toggleMultiDay" }] },
          { cond: "isSelfClosingSelection", target: "focused", actions: [{ assign: "selectSingleDay" }] },
          { actions: [{ assign: "selectSingleDay" }] },
        ],
        "CELL.POINTER_MOVE": [
          { cond: "isRangePicker", actions: [{ assign: "setHoveredValue" }] },
        ],
        "TABLE.POINTER_LEAVE": [{ actions: [{ assign: "clearHoveredValue" }] }],
        "TABLE.ENTER": [
          { cond: "isAboveDayView", actions: [{ assign: "drillIntoView" }] },
          { cond: "isRangePicker", actions: [{ assign: "selectRangeDay" }] },
          { cond: "isMultiPicker", actions: [{ assign: "toggleMultiDay" }] },
          { cond: "isSelfClosingSelection", target: "focused", actions: [{ assign: "selectSingleDay" }] },
          { actions: [{ assign: "selectSingleDay" }] },
        ],
        "TABLE.ESCAPE": [{ target: "focused" }],
      },
    },
  },
};

const implementations = {
  conds: {
    isDayView: (ctx: DatePickerContext): boolean => ctx.view === "day",
    isAboveDayView: (ctx: DatePickerContext): boolean => ctx.view !== "day",
    isRangePicker: (ctx: DatePickerContext): boolean => ctx.selectionMode === "range",
    isMultiPicker: (ctx: DatePickerContext): boolean => ctx.selectionMode === "multiple",
    isSelfClosingSelection: (ctx: DatePickerContext): boolean => ctx.closeOnSelect,
  },
  assigns: {
    setValue: (ctx: DatePickerContext, e: DatePickerEvent): Partial<DatePickerContext> => {
      if (e.type !== "VALUE.SET") return {};
      const value = normalizeDays(daysOf(e.value), ctx.min, ctx.max);
      return {
        value,
        startValue: value.length > 0 ? value[0] ?? null : null,
        activeIndex: 0,
        focusedValue: value.length > 0 ? value[0] ?? ctx.focusedValue : ctx.focusedValue,
      };
    },
    clearValue: (): Partial<DatePickerContext> => ({ value: [], startValue: null, activeIndex: 0 }),
    setFocusedValue: (ctx: DatePickerContext, e: DatePickerEvent): Partial<DatePickerContext> => {
      if (e.type !== "FOCUS.SET") return {};
      const day = dayRecord(e.focusedValue);
      if (day === null) return {};
      const value = clampDay(day, ctx.min, ctx.max);
      // Entering a month whose length would truncate the day re-clamps the
      // focus; the value it belongs to stays untouched.
      return { focusedValue: value };
    },
    /** Outside the day view, focus moves jump pages, not days. */
    moveFocusedValue: (ctx: DatePickerContext, e: DatePickerEvent): Partial<DatePickerContext> => {
      if (e.type !== "FOCUS.SET") return {};
      const day = dayRecord(e.focusedValue);
      if (day === null) return {};
      const value = clampDay(day, ctx.min, ctx.max);
      const view: DatePickerView = value.year !== ctx.focusedValue.year
        ? "year"
        : value.month !== ctx.focusedValue.month ? "month" : "day";
      return { focusedValue: value, view };
    },
    setView: (_ctx: DatePickerContext, e: DatePickerEvent): Partial<DatePickerContext> => {
      if (e.type !== "VIEW.SET") return {};
      return { view: viewOf(e.view) };
    },
    resetView: (ctx: DatePickerContext): Partial<DatePickerContext> => {
      const anchored = ctx.value.length > 0 ? clampDay(ctx.value[0] ?? ctx.focusedValue, ctx.min, ctx.max) : null;
      return {
        view: "day",
        focusedValue: anchored ?? (inBounds(ctx.focusedValue, ctx.min, ctx.max)
          ? ctx.focusedValue
          : clampDay(ctx.focusedValue, ctx.min, ctx.max)),
      };
    },
    drillIntoView: (ctx: DatePickerContext, e: DatePickerEvent): Partial<DatePickerContext> => {
      if (e.type !== "CELL.CLICK" && e.type !== "TABLE.ENTER") return {};
      const value = clampDay(e.value, ctx.min, ctx.max);
      const view: DatePickerView = ctx.view === "year" ? "month" : "day";
      return { focusedValue: value, view };
    },
    selectSingleDay: (ctx: DatePickerContext, e: DatePickerEvent): Partial<DatePickerContext> => {
      if (e.type !== "CELL.CLICK" && e.type !== "TABLE.ENTER") return {};
      const value = clampDay(e.value, ctx.min, ctx.max);
      return {
        value: [value],
        startValue: null,
        activeIndex: 0,
        focusedValue: value,
        hoveredValue: null,
      };
    },
    toggleMultiDay: (ctx: DatePickerContext, e: DatePickerEvent): Partial<DatePickerContext> => {
      if (e.type !== "CELL.CLICK" && e.type !== "TABLE.ENTER") return {};
      const value = clampDay(e.value, ctx.min, ctx.max);
      const hit = ctx.value.findIndex((day) => sameDay(day, value));
      const value_ = hit === -1
        ? [...ctx.value, value]
        : ctx.value.filter((_day, at) => at !== hit);
      return {
        value: normalizeDays(value_, ctx.min, ctx.max),
        startValue: null,
        activeIndex: 0,
        focusedValue: value,
        hoveredValue: null,
      };
    },
    /**
     * Range mode: the first click names the start, the second the end —
     * including backwards, where the earlier day wins (Zag's sortDates).
     */
    selectRangeDay: (ctx: DatePickerContext, e: DatePickerEvent): Partial<DatePickerContext> => {
      if (e.type !== "CELL.CLICK" && e.type !== "TABLE.ENTER") return {};
      const value = clampDay(e.value, ctx.min, ctx.max);
      if (ctx.startValue === null) {
        return { startValue: value, focusedValue: value };
      }
      const first = clampDay(ctx.startValue, ctx.min, ctx.max);
      const [lo, hi] = sortKey(first) <= sortKey(value) ? [first, value] : [value, first];
      return {
        value: [lo, hi],
        startValue: null,
        activeIndex: 0,
        focusedValue: value,
        hoveredValue: null,
      };
    },
    setHoveredValue: (ctx: DatePickerContext, e: DatePickerEvent): Partial<DatePickerContext> => {
      if (e.type !== "CELL.POINTER_MOVE") return {};
      if (ctx.startValue === null) return {};
      return { hoveredValue: clampDay(e.value, ctx.min, ctx.max) };
    },
    clearHoveredValue: (): Partial<DatePickerContext> => ({ hoveredValue: null }),
  },
};

function normalizeDays(
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

export function datePicker(
  args: DatePickerArgs = {},
  authored: (name: string) => boolean,
): Machine<DatePickerContext, DatePickerEvent> {
  return createMachine<DatePickerContext, DatePickerEvent>({
    ...config,
    ...implementations,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host
     * may write, and the event each write carries. A field with an event
     * is REPORTED (the host's write is an event, the machine decides,
     * and the change reaches the host); a field without one is SILENT
     * (the host's write lands in the field, and nothing reports).
     */
    fields: {
      value: { event: "VALUE.SET" },
      focusedValue: { event: "FOCUS.SET" },
      view: { event: "VIEW.SET" },
      selectionMode: {},
      numOfMonths: {},
      min: {},
      max: {},
      closeOnSelect: {},
    },
  });
}

