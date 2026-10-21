import { ariaCurrent, ariaInvalid, ariaLabelledBy, dataAttr, defineComponent, disclosureTrigger, isRecord, optionRow, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import {
  dayAsString,
  daysInMonth,
  datePicker as datePickerMachine,
  parseDay,
  valueAsAllStrings,
  type DatePickerArgs,
  type DatePickerContext,
  type DatePickerEvents,
  type DatePickerSelectionMode,
  type DatePickerValue,
  type DatePickerValueChange,
  type DatePickerView,
} from "./date-picker.machine.ts";

/**
 * Date-picker definition: the DOM contract as data. The machine holds the
 * modes, the value, the focused day, and the view; this file maps props to
 * channels, parts to attribute bags, commands to sends, and
 * value/focus/view/open transitions to their events.
 *
 * Everything that needs a calendar grid lives here: the visible days for a
 * month, the twelve months, the decade of years, and which day the arrows
 * move to. That is derivation from the focused day — and the corpus rule
 * puts it in the view, not the machine.
 *
 * The panel is the native `<popover>` behind the same app-controller
 * handle as the machine tier; light-dismiss and Escape are the browser's,
 * and the `anchor` action positions the panel against the trigger exactly
 * as the tooltip does. The trigger shows the committed selection as a
 * formatted string (the picker has no text input: typing a date is the
 * date-input's job).
 */

export type {
  DatePickerSelectionMode,
  DatePickerView,
  DatePickerValue,
  DatePickerValueChange,
};

export interface DatePickerApi {
  readonly isOpen: boolean;
  readonly value: readonly DatePickerValue[];
  readonly valueAsString: readonly string[];
  readonly focusedValue: DatePickerValue;
  readonly view: DatePickerView;
  open(): void;
  close(): void;
  clear(): void;
  setValue(value: readonly DatePickerValue[] | null): void;
  getTriggerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getGridProps(): Record<string, unknown>;
  getWeekdayLabels(): readonly string[];
  getValueTextRows(): readonly { readonly value: string; readonly text: string }[];
  getViewTextRows(): readonly { readonly value: string; readonly text: string }[];
  getCells(): readonly DatePickerCellView[];
  getCellProps(cell: DatePickerCellView): Record<string, unknown>;
  getPrevTriggerProps(): Record<string, unknown>;
  getNextTriggerProps(): Record<string, unknown>;
  getViewControlProps(): Record<string, unknown>;
  getClearTriggerProps(): Record<string, unknown>;
}

/**
 * One grid cell. `value` is the day it names in every view — a month cell
 * is that month's first day, a year cell January first — so the machine's
 * clamp and the focus moves speak one currency.
 */
export interface DatePickerCellView {
  readonly key: string;
  readonly value: DatePickerValue;
  /** A day from the month before or after, shown greyed (day view only). */
  readonly outside: boolean;
  readonly isToday: boolean;
  readonly selected: boolean;
  /** Inside the selected range, including its hover preview. */
  readonly inRange: boolean;
  readonly rangeEdge: "start" | "end" | null;
  readonly disabled: boolean;
}

const DAY_MS = 86_400_000;

const iso = (value: DatePickerValue): string => dayAsString(value);

const sameDay = (a: DatePickerValue, b: DatePickerValue): boolean => iso(a) === iso(b);

const dayTime = (value: DatePickerValue): number => Date.UTC(value.year, value.month - 1, value.day);

const boundTime = (bound: string | null): number | null => {
  if (bound === null || bound.length === 0) return null;
  const time = Date.parse(`${bound}T00:00:00Z`);
  return Number.isNaN(time) ? null : time;
};

const today = (): DatePickerValue => {
  const at = new Date();
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
};

const monthName = (month: number, locale: string): string =>
  new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(Date.UTC(2024, month - 1, 1));

interface ScopeLike extends PartScope<unknown, DatePickerContext> {}

interface SlotLike<R> extends SlotScope<R, DatePickerContext> {}

// Scope props arrive as strings; hooks write numbers.
const numProp = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

type IdFn = (part: string, slot?: unknown) => string;

const shift = (
  from: DatePickerValue,
  days: number,
  min: string | null,
  max: string | null,
): DatePickerValue => {
  const moved = new Date(dayTime(from) + days * DAY_MS);
  const value: DatePickerValue = {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: Math.min(moved.getUTCDate(), daysInMonth(moved.getUTCFullYear(), moved.getUTCMonth() + 1)),
  };
  const floor = boundTime(min);
  const ceiling = boundTime(max);
  const time = dayTime(value);
  if (floor !== null && time < floor) return parseDay(min ?? "") ?? value;
  if (ceiling !== null && time > ceiling) return parseDay(max ?? "") ?? value;
  return value;
};

const cellView = (
  context: DatePickerContext,
  props: Record<string, unknown>,
  value: DatePickerValue,
  outside: boolean,
): DatePickerCellView => {
  const ctx = context;
  const disabled = props["disabled"] === true;
  const readOnly = props["readOnly"] === true;
  const time = dayTime(value);
  const floor = boundTime(ctx.min);
  const ceiling = boundTime(ctx.max);
  // An armed-but-uncommitted start counts as the range's start, and the
  // hover preview extends the span to the hovered day.
  const startDay = ctx.value.length >= 1 ? ctx.value[0] : ctx.startValue;
  const first = startDay == null ? Number.NaN : dayTime(startDay);
  const last = ctx.value.length >= 2
    ? dayTime(ctx.value[1] ?? ctx.value[0] ?? startDay ?? value)
    : first;
  const hover = ctx.hoveredValue === null ? Number.NaN : dayTime(ctx.hoveredValue);
  const lo = Math.min(first, last, Number.isNaN(hover) ? Number.POSITIVE_INFINITY : hover);
  const hi = Math.max(first, last, Number.isNaN(hover) ? Number.NEGATIVE_INFINITY : hover);
  const inRange = ctx.selectionMode === "range" && !Number.isNaN(first) &&
    time >= lo && time <= hi;
  return {
    key: iso(value),
    value,
    outside,
    isToday: sameDay(value, today()),
    selected: ctx.value.some((day) => sameDay(day, value)),
    inRange,
    rangeEdge: ctx.selectionMode === "range" && ctx.value.length === 2
      ? (sameDay(value, ctx.value[0] ?? value) ? "start" : sameDay(value, ctx.value[1] ?? value) ? "end" : null)
      : null,
    disabled: (floor !== null && time < floor) || (ceiling !== null && time > ceiling) || disabled || readOnly,
  };
};

const textOf = (raw: unknown, fallback: string): string =>
  typeof raw === "string" && raw.length > 0 ? raw : fallback;


type FormatFn = (value: DatePickerValue, at: string) => string;

const isFormat = (value: unknown): value is FormatFn =>
  typeof value === "function";

const isDateValue = (raw: unknown): raw is DatePickerValue => {
  if (!isRecord(raw)) return false;
  return ["year", "month", "day"].every((key) => typeof raw[key] === "number" && Number.isFinite(raw[key]));
};

const weekOf = (props: Record<string, unknown>): number => {
  const raw: unknown = props["startOfWeek"];
  return typeof raw === "number" && raw >= 0 && raw <= 6 ? Math.trunc(raw) : 0;
};

const dayCells = (
  context: DatePickerContext,
  props: Record<string, unknown>,
): readonly DatePickerCellView[] => {
  const ctx = context;
  const startOfWeek = weekOf(props);
  const start = { year: ctx.focusedValue.year, month: ctx.focusedValue.month, day: 1 };
  const firstWeekday = new Date(dayTime(start)).getUTCDay();
  const lead = (firstWeekday - startOfWeek + 7) % 7;
  const length = daysInMonth(start.year, start.month);
  const cells: DatePickerCellView[] = [];
  let walking = new Date(dayTime(start) - lead * DAY_MS);
  while (cells.length < lead + length) {
    const value: DatePickerValue = {
      year: walking.getUTCFullYear(),
      month: walking.getUTCMonth() + 1,
      day: walking.getUTCDate(),
    };
    cells.push(cellView(context, props, value, value.month !== start.month));
    walking = new Date(walking.getTime() + DAY_MS);
  }
  while (cells.length % 7 !== 0) {
    const value: DatePickerValue = {
      year: walking.getUTCFullYear(),
      month: walking.getUTCMonth() + 1,
      day: walking.getUTCDate(),
    };
    cells.push(cellView(context, props, value, value.month !== start.month));
    walking = new Date(walking.getTime() + DAY_MS);
  }
  return cells;
};

const cellsOf = (
  context: DatePickerContext,
  props: Record<string, unknown>,
): readonly DatePickerCellView[] => {
  const ctx = context;
  if (ctx.view === "month") {
    return Array.from({ length: 12 }, (_unused, month) =>
      cellView(context, props, { year: ctx.focusedValue.year, month: month + 1, day: 1 }, false));
  }
  if (ctx.view === "year") {
    const from = ctx.focusedValue.year - ((ctx.focusedValue.year % 12) + 12) % 12;
    return Array.from({ length: 12 }, (_unused, offset) =>
      cellView(context, props, { year: from + offset, month: 1, day: 1 }, false));
  }
  return dayCells(context, props);
};

/** A page is a month in the day view, a year in the month view, a decade in the year view. */
const pageOf = (scope: ScopeLike, from: DatePickerValue, direction: 1 | -1): DatePickerValue => {
  const ctx = scope.context;
  if (ctx.view === "month") return shift(from, direction * 365, ctx.min, ctx.max);
  if (ctx.view === "year") return shift(from, direction * 3652, ctx.min, ctx.max);
  return shift(from, direction * 28, ctx.min, ctx.max);
};

/** Cell handlers, cached per bridge by cell key: the scope reads live
 * through proxies, so a cached closure never goes stale. */
interface CellHandlers {
  readonly onClick: () => void;
  readonly onPointerMove: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}
const cellHandlersByBridge = new WeakMap<IdFn, Map<string, CellHandlers>>();
const handlersFor = (scope: ScopeLike, cell: DatePickerCellView): CellHandlers => {
  let byKey = cellHandlersByBridge.get(scope.id);
  if (byKey === undefined) {
    byKey = new Map();
    cellHandlersByBridge.set(scope.id, byKey);
  }
  const key = iso(cell.value);
  const hit = byKey.get(key);
  if (hit !== undefined) return hit;
  const made: CellHandlers = {
    onClick: (): void => {
      if (cell.disabled) return;
      const view = scope.context.view;
      if (view !== "day") scope.send({ type: "TABLE.ENTER", value: cell.value });
      else scope.send({ type: "CELL.CLICK", value: cell.value });
    },
    onPointerMove: (): void => {
      if (scope.context.selectionMode !== "range") return;
      scope.send({ type: "CELL.POINTER_MOVE", value: cell.value });
    },
    onKeyDown: (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing === true || event.keyCode === 229) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const at = scope.context;
      const focused = at.focusedValue;
      const rtl = scope.props["dir"] === "rtl";
      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          scope.send({ type: "TABLE.ENTER", value: focused });
          break;
        case "ArrowRight":
          event.preventDefault();
          scope.send({ type: "FOCUS.SET", focusedValue: shift(focused, rtl ? -1 : 1, at.min, at.max) });
          break;
        case "ArrowLeft":
          event.preventDefault();
          scope.send({ type: "FOCUS.SET", focusedValue: shift(focused, rtl ? 1 : -1, at.min, at.max) });
          break;
        case "ArrowUp":
          event.preventDefault();
          scope.send({ type: "FOCUS.SET", focusedValue: shift(focused, -7, at.min, at.max) });
          break;
        case "ArrowDown":
          event.preventDefault();
          scope.send({ type: "FOCUS.SET", focusedValue: shift(focused, 7, at.min, at.max) });
          break;
        case "PageUp":
          event.preventDefault();
          scope.send({ type: "FOCUS.SET", focusedValue: pageOf(scope, focused, -1) });
          break;
        case "PageDown":
          event.preventDefault();
          scope.send({ type: "FOCUS.SET", focusedValue: pageOf(scope, focused, 1) });
          break;
        case "Home":
          event.preventDefault();
          scope.send({ type: "FOCUS.SET", focusedValue: { year: focused.year, month: focused.month, day: 1 } });
          break;
        case "End":
          event.preventDefault();
          scope.send({
            type: "FOCUS.SET",
            focusedValue: { year: focused.year, month: focused.month, day: daysInMonth(focused.year, focused.month) },
          });
          break;
        case "Escape":
          event.preventDefault();
          scope.send({ type: "TABLE.ESCAPE" });
          break;
      }
    },
  };
  byKey.set(key, made);
  return made;
};

/**
 * Stable row holders for the text rows: a compiled `{row.text}` effect
 * reads off the render-time object, so fresh objects per read freeze the
 * text at its first value. Rewritten in place; the array is fresh each
 * read so the `for` syncs.
 */
const textRowsByBridge = new WeakMap<IdFn, Map<string, { value: string; text: string }>>();
const rowFor = (
  id: IdFn,
  key: string,
  text: string,
): { value: string; text: string } => {
  let rows = textRowsByBridge.get(id);
  if (rows === undefined) {
    rows = new Map();
    textRowsByBridge.set(id, rows);
  }
  const hit = rows.get(key) ?? { value: key, text: "" };
  hit.text = text;
  rows.set(key, hit);
  return hit;
};

const def: ComponentDef<DatePickerContext, DatePickerEvents> = {
  name: "date-picker",
  machine: (props, authored) => datePickerMachine(props as DatePickerArgs, authored),
  establish: (raw, authored) => {
    // The open fact lives in the state, not the context, so it is the one
    // thing the establish carries.
    if (!authored("open") || raw["open"] !== true) return [];
    return [{ type: "OPEN" }];
  },
  // A focus move hands DOM focus to the cell it named; opening holds the
  // focus still (the re-anchor often moves nothing, so the panel takes
  // focus itself). The cell id embeds the day, which the id path cannot
  // express — so the query stays inside the owned root.
  settled: ({ before, after, root }) => {
    const was = dayAsString(before.context.focusedValue);
    const at = dayAsString(after.context.focusedValue);
    if (at === was) return;
    const host = root();
    if (typeof host.querySelector !== "function") return;
    const cell = host.querySelector(`[data-value="${at}"]`);
    if (cell instanceof HTMLElement) cell.focus({ preventScroll: true });
  },
  parts: {
    trigger: {
      attrs: (scope) => {
        const ctx = scope.context;
        const open = scope.state === "open";
        return {
          id: scope.id("trigger"),
          "aria-label": scope.props["label"],
          ...disclosureTrigger(scope, {
            expanded: open,
            hasPopup: "dialog",
          }),
          "data-state": open ? "open" : "closed",
          ...ariaInvalid(scope.props["invalid"] === true ? true : undefined),
          onClick: (): void => scope.send({ type: open ? "CLOSE" : "OPEN" }),
        };
      },
    },
    content: {
      attrs: (scope) => {
        const open = scope.state === "open";
        const focused = iso(scope.context.focusedValue);
        return {
          id: scope.id("content"),
          role: "dialog",
          // Opening hands the focused day the focus: the trigger's keys
          // stop applying once the panel is up, so the keyboard walk
          // starts inside.
          "use:date-picker-focus": {
            open,
            cellId: `${scope.id("grid")}:cell:${focused}`,
          },
          "aria-label": scope.props["label"],
          "data-state": open ? "open" : "closed",
          "use:dismissable": {
            onOutside: (event: PointerEvent): void => {
              const target = event.target;
              // The trigger is this component's own gesture: a press on
              // it toggles, it does not dismiss. The id carries colons,
              // invalid in an id selector, so `closest` throws.
              if (target instanceof Element && target.closest(`[id="${scope.id("trigger")}"]`) !== null) {
                return;
              }
              scope.send({ type: "CLOSE.OUTSIDE" });
            },
            onEscape: (): void => scope.send({ type: "TABLE.ESCAPE" }),
          },
        };
      },
    },
    grid: {
      attrs: (scope) => {
        const ctx = scope.context;
        return {
          id: scope.id("grid"),
          role: "grid",
          tabIndex: 0,
          ...ariaLabelledBy(scope, { part: "label" }),
          // The view decides the grid's shape: seven weekday columns,
          // three months, four years. The recipe's `data-[view]` variants
          // read it.
          "data-view": ctx.view,
          onPointerLeave: (): void => scope.send({ type: "TABLE.POINTER_LEAVE" }),
        };
      },
    },
    label: {
      attrs: (scope) => ({
        id: scope.id("label"),
      }),
    },
    prevTrigger: {
      id: "prev",
      attrs: (scope) => ({
        id: scope.id("prevTrigger"),
        "aria-label": "Previous",
        onClick: (): void => {
          const ctx = scope.context;
          scope.send({ type: "FOCUS.SET", focusedValue: pageOf(scope, ctx.focusedValue, -1) });
        },
      }),
    },
    nextTrigger: {
      id: "next",
      attrs: (scope) => ({
        id: scope.id("nextTrigger"),
        "aria-label": "Next",
        onClick: (): void => {
          const ctx = scope.context;
          scope.send({ type: "FOCUS.SET", focusedValue: pageOf(scope, ctx.focusedValue, 1) });
        },
      }),
    },
    viewControl: {
      id: "view",
      attrs: (scope) => {
        const ctx = scope.context;
        return {
          id: scope.id("viewControl"),
          "data-view": ctx.view,
          onClick: (): void => {
            if (ctx.view === "day") scope.send({ type: "VIEW.SET", view: "month" });
            else if (ctx.view === "month") scope.send({ type: "VIEW.SET", view: "year" });
            else scope.send({ type: "VIEW.SET", view: "day" });
          },
        };
      },
    },
    clearTrigger: {
      id: "clear",
      attrs: (scope) => {
        const ctx = scope.context;
        return {
          id: scope.id("clearTrigger"),
          "aria-label": "Clear",
          hidden: ctx.value.length === 0,
          onClick: (): void => scope.send({ type: "VALUE.CLEAR" }),
        };
      },
    },
  },
  slots: {
    cell: {
      indexes: (context: DatePickerContext, props) => cellsOf(context, props),
      attrs: (scope: SlotLike<DatePickerCellView>) => {
        const cell = scope.slot;
        const ctx = scope.context;
        const locale = textOf(scope.props["locale"], "en-US");
        const day = iso(cell.value);
        const focused = day === iso(ctx.focusedValue);
        const text = ctx.view === "month"
          ? monthName(cell.value.month, locale)
          : ctx.view === "year" ? `${cell.value.year}` : `${cell.value.day}`;
        return {
          id: `${scope.id("grid")}:cell:${day}`,
          role: "gridcell",
          ...optionRow({
            selected: cell.selected,
            disabled: cell.disabled ? true : undefined,
          }),
          ...ariaCurrent(cell.isToday && ctx.view === "day" ? "date" : undefined),
          "data-value": day,
          "data-outside-month": dataAttr(cell.outside),
          "data-today": dataAttr(cell.isToday),
          "data-selected": dataAttr(cell.selected),
          "data-in-range": dataAttr(cell.inRange),
          "data-range-start": dataAttr(cell.rangeEdge === "start"),
          "data-range-end": dataAttr(cell.rangeEdge === "end"),
          "data-disabled": dataAttr(cell.disabled),
          "data-focus": dataAttr(focused),
          // The view the cell belongs to, so the recipe can size day
          // rows differently from month and year rows.
          "data-view": ctx.view,
          tabIndex: focused ? 0 : -1,
          text,
          ...handlersFor(scope, cell),
        };
      },
    },
  },
  commands: {
    open: { event: () => ({ type: "OPEN" }) },
    close: { event: () => ({ type: "CLOSE" }) },
    clear: { event: () => ({ type: "VALUE.CLEAR" }) },
    setValue: {
      event: (args) => {
        const raw = args[0];
        if (raw === null) return { type: "VALUE.SET", value: [] };
        if (!Array.isArray(raw)) return { type: "VALUE.SET", value: [] };
        const days = raw.filter(isDateValue);
        return { type: "VALUE.SET", value: [...days] };
      },
    },
  },
  readers: {
    isOpen: { read: (_context, state) => state === "open" },
    value: { read: (context) => [...context.value] },
    valueAsString: { read: (context) => valueAsAllStrings(context.value) },
    focusedValue: { read: (context) => ({ ...context.focusedValue }) },
    view: { read: (context) => context.view },
  },
  methods: {
    getWeekdayLabels: {
      call: (context: DatePickerContext, _state, _args, props) => {
        const ctx = context;
        const locale = textOf(props["locale"], "en-US");
        const startOfWeek = weekOf(props);
        const labels: string[] = [];
        // The month and year grids have no weekday rows.
        if (ctx.view !== "day") return labels;
        for (let at = 0; at < 7; at++) {
          const weekday = (startOfWeek + at) % 7;
          labels.push(
            new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(
              Date.UTC(2024, 0, 7 + weekday),
            ),
          );
        }
        return labels;
      },
    },
    getValueTextRows: {
      call: (context: DatePickerContext, _state, _args, props, id) => {
        const ctx = context;
        const locale = textOf(props["locale"], "en-US");
        const placeholder = textOf(props["placeholder"], "Pick a date");
        const format: unknown = props["format"];
        const formatDay = isFormat(format)
          ? format
          : (value: DatePickerValue, at: string): string => {
            const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
            return new Intl.DateTimeFormat(at, {
              year: "numeric",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            }).format(date);
          };
        if (ctx.value.length === 0) {
          return [rowFor(id, `empty:${placeholder}`, placeholder)];
        }
        return ctx.value.map((day) => rowFor(id, iso(day), formatDay(day, locale)));
      },
    },
    getViewTextRows: {
      call: (context: DatePickerContext, _state, _args, props, id: IdFn) => {
        const ctx = context;
        const locale = textOf(props["locale"], "en-US");
        const text = ctx.view === "day"
          ? new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(Date.UTC(ctx.focusedValue.year, ctx.focusedValue.month - 1, 1))
          : ctx.view === "month"
          ? `${ctx.focusedValue.year}`
          : `${ctx.focusedValue.year - (((ctx.focusedValue.year % 12) + 12) % 12)}`;
        return [rowFor(id, `view:${ctx.view}:${iso(ctx.focusedValue)}`, text)];
      },
    },
    getCells: {
      call: (context: DatePickerContext, _state, _args, props) => cellsOf(context, props),
    },
  },
  events: {
    "value-change": {
      prop: "onValueChange",
      watch: (context) => [context.value.map(dayAsString).join(",")],
      detail: (_watched, _event, _props, context: DatePickerContext) => ({
        value: [...context.value],
        valueAsString: valueAsAllStrings(context.value),
      }),
    },
    "focus-change": {
      prop: "onFocusChange",
      watch: (context) => [dayAsString(context.focusedValue), context.view],
      detail: (_watched, _event, _props, context: DatePickerContext) => ({
        focusedValue: { ...context.focusedValue },
        view: context.view,
      }),
    },
    "view-change": {
      prop: "onViewChange",
      watch: (context) => [context.view],
      detail: (watched: readonly unknown[]) => {
        const view = watched[0];
        const known: DatePickerView = view === "month" || view === "year" ? view : "day";
        return { view: known };
      },
    },
    "open-change": {
      prop: "onOpenChange",
      watch: (_context, state) => [state === "open"],
      detail: (watched: readonly unknown[]) => ({ open: watched[0] === true }),
    },
  },
};

export const datePicker = defineComponent<DatePickerContext, DatePickerEvents, DatePickerApi>(def);
