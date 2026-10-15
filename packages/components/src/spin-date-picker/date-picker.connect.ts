/**
 * Date-picker connect: the DOM contract, the grid the view owns, and the
 * keyboard map.
 *
 * The machine holds the modes, the value, the focused day, and the view.
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

import {
  dayAsString,
  daysInMonth,
  valueAsAllStrings,
  type DatePickerContext,
  type DatePickerEvent,
  type DatePickerValue,
  type DatePickerView,
} from "./date-picker.machine.ts";

export interface DatePickerConnectProps {
  readonly locale: string;
  /** 0 is Sunday; the week's first weekday. */
  readonly startOfWeek: number;
  readonly label: string;
  readonly placeholder: string;
  readonly format: (value: DatePickerValue, locale: string) => string;
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly readOnly: boolean;
  readonly dir: "ltr" | "rtl";
}

export interface DatePickerCommands {
  open(): void;
  close(): void;
  clear(): void;
  setValue(value: readonly DatePickerValue[] | null): void;
}

export interface DatePickerApi extends DatePickerCommands {
  /** Whether the panel is open; the reactive channel is open-change. */
  readonly isOpen: boolean;
  readonly value: readonly DatePickerValue[];
  readonly valueAsString: readonly string[];
  readonly focusedValue: DatePickerValue;
  readonly view: DatePickerView;
  getTriggerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getGridProps(): Record<string, unknown>;
  getWeekdayLabels(): readonly string[];
  /** The selected days as rows, for the trigger's text (select's pattern). */
  getValueTextRows(): readonly { readonly value: string; readonly text: string }[];
  /** The view label as one row, for the view control (the same pattern). */
  getViewTextRows(): readonly { readonly value: string; readonly text: string }[];
  getCells(): readonly DatePickerCellView[];
  getCellProps(cell: DatePickerCellView): Record<string, unknown>;
  getPrevTriggerProps(): Record<string, unknown>;
  getNextTriggerProps(): Record<string, unknown>;
  getViewControlProps(): Record<string, unknown>;
  getClearTriggerProps(): Record<string, unknown>;
}

export interface DatePickerService {
  readonly context: DatePickerContext;
  readonly isOpen: boolean;
  send(event: DatePickerEvent): void;
}

export type ReadDatePickerProps = () => DatePickerConnectProps;

/**
 * One grid cell. `value` is the day it names in every view — a month cell
 * is that month's first day, a year cell January first — so the machine's
 * clamp and the focus moves speak one currency.
 */
export interface DatePickerCellView {
  /** Stable key for the for-rows: the ISO day the cell names. */
  readonly key: string;
  readonly value: DatePickerValue;
  /** A day from the month before or after, shown greyed (day view only). */
  readonly outside: boolean;
  readonly isToday: boolean;
  readonly selected: boolean;
  /** Inside the selected range, including its hover preview. */
  readonly inRange: boolean;
  readonly rangeEdge: "start" | "end" | null;
  /** Otherwise unreachable: outside the min/max bounds, or disabled. */
  readonly disabled: boolean;
}

const NAMESPACE = "date-picker";
const DAY_MS = 86_400_000;

function dataAttr(value: boolean): string | undefined {
  return value ? "" : undefined;
}

const iso = (value: DatePickerValue): string => dayAsString(value);

const sameDay = (a: DatePickerValue, b: DatePickerValue): boolean => iso(a) === iso(b);

const dayTime = (value: DatePickerValue): number => Date.UTC(value.year, value.month - 1, value.day);

const boundTime = (bound: string | null): number | null => {
  if (bound === null || bound.length === 0) return null;
  const time = Date.parse(`${bound}T00:00:00Z`);
  return Number.isNaN(time) ? null : time;
};

/** The day the browser says today is, in UTC. */
const today = (): DatePickerValue => {
  const at = new Date();
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
};

const monthName = (month: number, locale: string): string =>
  new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(Date.UTC(2024, month - 1, 1));

export function connectRobotDatePicker(
  service: DatePickerService,
  readProps: ReadDatePickerProps,
  id: string,
): DatePickerApi {
  const ownerId = id.startsWith(`${NAMESPACE}:`) ? id : `${NAMESPACE}:${id}`;
  const gridId = `${ownerId}:grid`;
  const triggerId = `${ownerId}:trigger`;

  const ctx = (): DatePickerContext => service.context;
  const props = (): DatePickerConnectProps => readProps();

  const parseIsoDay = (day: string): DatePickerValue | null => {
    const time = Date.parse(`${day}T00:00:00Z`);
    if (Number.isNaN(time)) return null;
    const at = new Date(time);
    return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
  };

  /** N days from a day, clamped to its own month and the bounds. */
  const shift = (from: DatePickerValue, days: number, min: string | null, max: string | null): DatePickerValue => {
    const moved = new Date(dayTime(from) + days * DAY_MS);
    const value: DatePickerValue = {
      year: moved.getUTCFullYear(),
      month: moved.getUTCMonth() + 1,
      day: Math.min(moved.getUTCDate(), daysInMonth(moved.getUTCFullYear(), moved.getUTCMonth() + 1)),
    };
    const floor = boundTime(min);
    const ceiling = boundTime(max);
    const time = dayTime(value);
    if (floor !== null && time < floor) return parseIsoDay(min ?? "") ?? value;
    if (ceiling !== null && time > ceiling) return parseIsoDay(max ?? "") ?? value;
    return value;
  };

  /** A page is a month in the day view, a year in the month view, a decade in the year view. */
  const pageOf = (from: DatePickerValue, direction: 1 | -1): DatePickerValue => {
    const at = ctx();
    const { min, max } = at;
    if (at.view === "month") return shift(from, direction * 365, min, max);
    if (at.view === "year") return shift(from, direction * 3652, min, max);
    return shift(from, direction * 28, min, max);
  };

  const send = (event: DatePickerEvent): void => {
    const before = iso(ctx().focusedValue);
    const wasOpen = service.isOpen;
    service.send(event);
    // A focus move hands DOM focus to the cell it named — the view's reflex,
    // exactly as the menu and tree-view connectors do it.
    const after = iso(ctx().focusedValue);
    if (after !== before) {
      const node = document.getElementById(`${gridId}:cell:${after}`);
      if (node instanceof HTMLElement) node.focus();
      return;
    }
    // Opening holds the focus still (resetView re-anchors on the value, so
    // the move above often does not fire): the panel takes focus itself.
    if (!wasOpen && service.isOpen) {
      const node = document.getElementById(`${gridId}:cell:${after}`);
      if (node instanceof HTMLElement) node.focus();
    }
  };

  const cellHandlers = new Map<string, {
    readonly onClick: () => void;
    readonly onPointerMove: () => void;
    readonly onKeyDown: (event: KeyboardEvent) => void;
  }>();

  const handlersFor = (cell: DatePickerCellView): {
    onClick: () => void;
    onPointerMove: () => void;
    onKeyDown: (event: KeyboardEvent) => void;
  } => {
    const key = iso(cell.value);
    const hit = cellHandlers.get(key);
    if (hit !== undefined) return hit;
    const made = {
      onClick: () => {
        if (cell.disabled) return;
        const at = ctx();
        if (at.view !== "day") send({ type: "TABLE.ENTER", value: cell.value });
        else send({ type: "CELL.CLICK", value: cell.value });
      },
      onPointerMove: () => {
        if (ctx().selectionMode !== "range") return;
        send({ type: "CELL.POINTER_MOVE", value: cell.value });
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.isComposing === true || event.keyCode === 229) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const at = ctx();
        const focused = at.focusedValue;
        switch (event.key) {
          case "Enter":
          case " ":
            event.preventDefault();
            send({ type: "TABLE.ENTER", value: focused });
            break;
          case "ArrowRight":
            event.preventDefault();
            send({ type: "FOCUS.SET", value: shift(focused, props().dir === "rtl" ? -1 : 1, at.min, at.max) });
            break;
          case "ArrowLeft":
            event.preventDefault();
            send({ type: "FOCUS.SET", value: shift(focused, props().dir === "rtl" ? 1 : -1, at.min, at.max) });
            break;
          case "ArrowUp":
            event.preventDefault();
            send({ type: "FOCUS.SET", value: shift(focused, -7, at.min, at.max) });
            break;
          case "ArrowDown":
            event.preventDefault();
            send({ type: "FOCUS.SET", value: shift(focused, 7, at.min, at.max) });
            break;
          case "PageUp":
            event.preventDefault();
            send({ type: "FOCUS.SET", value: pageOf(focused, -1) });
            break;
          case "PageDown":
            event.preventDefault();
            send({ type: "FOCUS.SET", value: pageOf(focused, 1) });
            break;
          case "Home":
            event.preventDefault();
            send({ type: "FOCUS.SET", value: { year: focused.year, month: focused.month, day: 1 } });
            break;
          case "End":
            event.preventDefault();
            send({ type: "FOCUS.SET", value: { year: focused.year, month: focused.month, day: daysInMonth(focused.year, focused.month) } });
            break;
          case "Escape":
            event.preventDefault();
            send({ type: "TABLE.ESCAPE" });
            break;
        }
      },
    };
    cellHandlers.set(key, made);
    return made;
  };

  const caches = new Map<string, { sig: string; bag: Record<string, unknown> }>();
  const cached = (key: string, sig: string, build: () => Record<string, unknown>): Record<string, unknown> => {
    const hit = caches.get(key);
    if (hit !== undefined && hit.sig === sig) return hit.bag;
    const bag = build();
    caches.set(key, { sig, bag });
    return bag;
  };

  /**
   * Stable row holders for the text rows: a compiled `{row.text}` effect
   * reads off the render-time object, so fresh objects per read freeze the
   * text at its first value (the select's rows survive because `rowOf`
   * hands back collection rows — stable identities). The holders are
   * rewritten in place; the array is fresh each read so the `for` syncs.
   */
  const textRows = new Map<string, { value: string; text: string }>();
  const rowFor = (key: string, text: string): { value: string; text: string } => {
    const hit = textRows.get(key) ?? { value: key, text: "" };
    hit.text = text;
    textRows.set(key, hit);
    return hit;
  };

  /** The day grid: the focused month padded to whole weeks both sides. */
  const dayCells = (): readonly DatePickerCellView[] => {
    const at = ctx();
    const props_ = props();
    const start = { year: at.focusedValue.year, month: at.focusedValue.month, day: 1 };
    const firstWeekday = new Date(dayTime(start)).getUTCDay();
    const lead = (firstWeekday - props_.startOfWeek + 7) % 7;
    const length = daysInMonth(start.year, start.month);
    const cells: DatePickerCellView[] = [];
    let walking = new Date(dayTime(start) - lead * DAY_MS);
    while (cells.length < lead + length) {
      const value: DatePickerValue = {
        year: walking.getUTCFullYear(),
        month: walking.getUTCMonth() + 1,
        day: walking.getUTCDate(),
      };
      cells.push(cellView(value, value.month !== start.month));
      walking = new Date(walking.getTime() + DAY_MS);
    }
    // Pad the tail so the grid is whole weeks; the walk rolls the month.
    while (cells.length % 7 !== 0) {
      const value: DatePickerValue = {
        year: walking.getUTCFullYear(),
        month: walking.getUTCMonth() + 1,
        day: walking.getUTCDate(),
      };
      cells.push(cellView(value, value.month !== start.month));
      walking = new Date(walking.getTime() + DAY_MS);
    }
    return cells;
  };

  const cellView = (value: DatePickerValue, outside: boolean): DatePickerCellView => {
    const at = ctx();
    const props_ = props();
    const time = dayTime(value);
    const floor = boundTime(at.min);
    const ceiling = boundTime(at.max);
    // The range endpoints, hoisted: an armed-but-uncommitted start counts
    // (the machine holds it as startValue), and the hover preview extends
    // the span to the hovered day.
    const startDay = at.value.length >= 1 ? at.value[0] : at.startValue;
    const first = startDay == null ? Number.NaN : dayTime(startDay);
    const last = at.value.length >= 2 ? dayTime(at.value[1] ?? at.value[0] ?? startDay ?? value) : first;
    const hover = at.hoveredValue === null ? Number.NaN : dayTime(at.hoveredValue);
    const lo = Math.min(first, last, Number.isNaN(hover) ? Number.POSITIVE_INFINITY : hover);
    const hi = Math.max(first, last, Number.isNaN(hover) ? Number.NEGATIVE_INFINITY : hover);
    const inRange = at.selectionMode === "range" && !Number.isNaN(first) &&
      time >= lo && time <= hi;
    return {
      key: iso(value),
      value,
      outside,
      isToday: sameDay(value, today()),
      selected: at.value.some((day) => sameDay(day, value)),
      inRange,
      rangeEdge: at.selectionMode === "range" && at.value.length === 2
        ? (sameDay(value, at.value[0] ?? value) ? "start" : sameDay(value, at.value[1] ?? value) ? "end" : null)
        : null,
      disabled: (floor !== null && time < floor) || (ceiling !== null && time > ceiling) || props_.disabled || props_.readOnly,
    };
  };

  const api: DatePickerApi = {
    get isOpen(): boolean {
      return service.isOpen;
    },
    get value(): readonly DatePickerValue[] {
      return ctx().value;
    },
    get valueAsString(): readonly string[] {
      return valueAsAllStrings(ctx().value);
    },
    get focusedValue(): DatePickerValue {
      return ctx().focusedValue;
    },
    get view(): DatePickerView {
      return ctx().view;
    },
    open: () => send({ type: "OPEN" }),
    close: () => send({ type: "CLOSE" }),
    clear: () => send({ type: "VALUE.CLEAR" }),
    setValue: (value) => send({ type: "VALUE.SET", value: value ?? [] }),

    getTriggerProps: () => {
      const at = ctx();
      const current = props();
      return cached(
        "trigger",
        `${service.isOpen}\u0000${iso(at.focusedValue)}\u0000${at.value.map(iso).join(",")}\u0000${current.disabled}`,
        () => ({
          id: `${ownerId}:trigger`,
          "aria-label": current.label,
          "aria-expanded": service.isOpen,
          "aria-haspopup": "dialog",
          "data-state": service.isOpen ? "open" : "closed",
          "aria-invalid": current.invalid ? true : undefined,
          onClick: () => send({ type: service.isOpen ? "CLOSE" : "OPEN" }),
        }),
      );
    },

    getContentProps: () =>
      cached("content", `${service.isOpen}`, () => ({
        id: `${ownerId}:content`,
        role: "dialog",
        "aria-label": props().label,
        "data-state": service.isOpen ? "open" : "closed",
        "use:dismissable": {
          onOutside: (event: PointerEvent) => {
            const target = event.target;
            // The trigger is this component's own gesture: a press on it
            // toggles, it does not dismiss. The attribute spelling: the id
            // carries colons, invalid in an id selector, so `closest` throws.
            if (target instanceof Element && target.closest(`[id="${triggerId}"]`) !== null) return;
            send({ type: "CLOSE.OUTSIDE" });
          },
          onEscape: () => send({ type: "TABLE.ESCAPE" }),
        },
      })),

    getGridProps: () =>
      cached("grid", `${iso(ctx().focusedValue)}\u0000${ctx().view}\u0000${props().startOfWeek}`, () => ({
        id: gridId,
        role: "grid",
        tabIndex: 0,
        "aria-labelledby": `${ownerId}:label`,
        // The view decides the grid's shape: seven weekday columns, three
        // months, four years. The recipe's `data-[view]` variants read it.
        "data-view": ctx().view,
        onPointerLeave: () => send({ type: "TABLE.POINTER_LEAVE" }),
      })),

    getValueTextRows: () => {
      const at = ctx();
      const current = props();
      if (at.value.length === 0) {
        return [rowFor(`empty:${current.placeholder}`, current.placeholder)];
      }
      return at.value.map((day) => rowFor(iso(day), current.format(day, current.locale)));
    },

    getViewTextRows: () => {
      const at = ctx();
      const current = props();
      const text = at.view === "day"
        ? new Intl.DateTimeFormat(current.locale, {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(Date.UTC(at.focusedValue.year, at.focusedValue.month - 1, 1))
        : at.view === "month"
        ? `${at.focusedValue.year}`
        : `${at.focusedValue.year - (((at.focusedValue.year % 12) + 12) % 12)}`;
      return [rowFor(`view:${at.view}:${iso(at.focusedValue)}`, text)];
    },

    getWeekdayLabels: () => {
      const current = props();
      const labels: string[] = [];
      // A weekday header only means something in the day view; the month
      // and year grids have no weekday rows.
      if (ctx().view !== "day") return labels;
      for (let at = 0; at < 7; at++) {
        const weekday = (current.startOfWeek + at) % 7;
        labels.push(
          new Intl.DateTimeFormat(current.locale, { weekday: "narrow", timeZone: "UTC" }).format(
            Date.UTC(2024, 0, 7 + weekday),
          ),
        );
      }
      return labels;
    },

    getCells: () => {
      const at = ctx();
      if (at.view === "month") {
        return Array.from({ length: 12 }, (_unused, month) =>
          cellView({ year: at.focusedValue.year, month: month + 1, day: 1 }, false));
      }
      if (at.view === "year") {
        const from = at.focusedValue.year - ((at.focusedValue.year % 12) + 12) % 12;
        return Array.from({ length: 12 }, (_unused, offset) =>
          cellView({ year: from + offset, month: 1, day: 1 }, false));
      }
      return dayCells();
    },

    getCellProps: (cell: DatePickerCellView) => {
      const at = ctx();
      const current = props();
      const day = iso(cell.value);
      const focused = day === iso(at.focusedValue);
      const text = at.view === "month"
        ? monthName(cell.value.month, current.locale)
        : at.view === "year" ? `${cell.value.year}` : `${cell.value.day}`;
      return cached(
        `cell:${day}`,
        `${focused}\u0000${cell.selected}\u0000${cell.inRange}\u0000${cell.rangeEdge ?? ""}\u0000${cell.disabled}\u0000${at.view}`,
        () => ({
          id: `${gridId}:cell:${day}`,
          role: "gridcell",
          "aria-selected": cell.selected,
          "aria-disabled": cell.disabled ? true : undefined,
          "aria-current": cell.isToday && at.view === "day" ? "date" : undefined,
          "data-value": day,
          "data-outside-month": dataAttr(cell.outside),
          "data-today": dataAttr(cell.isToday),
          "data-selected": dataAttr(cell.selected),
          "data-in-range": dataAttr(cell.inRange),
          "data-range-start": dataAttr(cell.rangeEdge === "start"),
          "data-range-end": dataAttr(cell.rangeEdge === "end"),
          "data-disabled": dataAttr(cell.disabled),
          "data-focus": dataAttr(focused),
          // The view the cell belongs to, so the recipe can size day rows
          // differently from month and year rows.
          "data-view": at.view,
          tabIndex: focused ? 0 : -1,
          text,
          ...handlersFor(cell),
        }),
      );
    },

    getPrevTriggerProps: () =>
      cached("prev", `${iso(ctx().focusedValue)}\u0000${ctx().view}`, () => ({
        id: `${ownerId}:prev`,
        "aria-label": "Previous",
        onClick: () => send({ type: "FOCUS.SET", value: pageOf(ctx().focusedValue, -1) }),
      })),

    getNextTriggerProps: () =>
      cached("next", `${iso(ctx().focusedValue)}\u0000${ctx().view}`, () => ({
        id: `${ownerId}:next`,
        "aria-label": "Next",
        onClick: () => send({ type: "FOCUS.SET", value: pageOf(ctx().focusedValue, 1) }),
      })),

    getViewControlProps: () =>
      cached("view", `${ctx().view}\u0000${iso(ctx().focusedValue)}`, () => {
        const at = ctx();
        return {
          id: `${ownerId}:view`,
          "data-view": at.view,
          onClick: () => {
            if (at.view === "day") send({ type: "VIEW.SET", view: "month" });
            else if (at.view === "month") send({ type: "VIEW.SET", view: "year" });
            else send({ type: "VIEW.SET", view: "day" });
          },
        };
      }),

    getClearTriggerProps: () =>
      cached("clear", `${ctx().value.map(iso).join(",")}`, () => ({
        id: `${ownerId}:clear`,
        "aria-label": "Clear",
        hidden: ctx().value.length === 0,
        onClick: () => send({ type: "VALUE.CLEAR" }),
      })),
  };

  return api;
}
