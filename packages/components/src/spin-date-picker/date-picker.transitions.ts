import type { AssignFor, GuardFor } from "@spin/runtime/fsm";
import type { DatePickerEvents } from "./date-picker.events.ts";
import {
  clampDay,
  dayRecord,
  daysOf,
  normalizeDays,
  sameDay,
  type DatePickerContext,
} from "./date-picker.state.ts";

type DatePickerAssign<K extends keyof DatePickerEvents = keyof DatePickerEvents> = AssignFor<
  DatePickerContext,
  DatePickerEvents,
  K
>;

export const resetView: DatePickerAssign<"OPEN"> = (ctx) => {
  const anchored = ctx.value.length > 0 ? clampDay(ctx.value[0] ?? ctx.focusedValue, ctx.min, ctx.max) : null;
  return {
    view: "day",
    focusedValue: anchored ?? ctx.focusedValue,
  };
};

export const drillIntoView: DatePickerAssign<"CELL.CLICK" | "TABLE.ENTER"> = (ctx, event) => {
  const value = clampDay(event.value, ctx.min, ctx.max);
  const view = ctx.view === "year" ? "month" : "day";
  return { focusedValue: value, view };
};

export const selectSingleDay: DatePickerAssign<"CELL.CLICK" | "TABLE.ENTER"> = (ctx, event) => {
  const value = clampDay(event.value, ctx.min, ctx.max);
  return {
    value: [value],
    startValue: null,
    activeIndex: 0,
    focusedValue: value,
    hoveredValue: null,
  };
};

export const toggleMultiDay: DatePickerAssign<"CELL.CLICK" | "TABLE.ENTER"> = (ctx, event) => {
  const value = clampDay(event.value, ctx.min, ctx.max);
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
};

export const selectRangeDay: DatePickerAssign<"CELL.CLICK" | "TABLE.ENTER"> = (ctx, event) => {
  const value = clampDay(event.value, ctx.min, ctx.max);
  if (ctx.startValue === null) {
    return { startValue: value, focusedValue: value };
  }
  const first = clampDay(ctx.startValue, ctx.min, ctx.max);
  const [lo, hi] = first.year * 10000 + first.month * 100 + first.day <=
      value.year * 10000 + value.month * 100 + value.day
    ? [first, value]
    : [value, first];
  return {
    value: [lo, hi],
    startValue: null,
    activeIndex: 0,
    focusedValue: value,
    hoveredValue: null,
  };
};

export const setValue: DatePickerAssign<"VALUE.SET"> = (ctx, event) => {
  const value = normalizeDays(daysOf(event.value), ctx.min, ctx.max);
  return {
    value,
    startValue: value.length > 0 ? value[0] ?? null : null,
    activeIndex: 0,
    focusedValue: value.length > 0 ? value[0] ?? ctx.focusedValue : ctx.focusedValue,
  };
};

export const clearValue: DatePickerAssign<"VALUE.CLEAR"> = () => ({
  value: [],
  startValue: null,
  activeIndex: 0,
});

export const setFocusDay: DatePickerAssign<"FOCUS.SET"> = (ctx, event) => {
  const day = dayRecord(event.focusedValue);
  if (day === null) return {};
  return { focusedValue: clampDay(day, ctx.min, ctx.max) };
};

export const setFocusAboveDay: DatePickerAssign<"FOCUS.SET"> = (ctx, event) => {
  const day = dayRecord(event.focusedValue);
  if (day === null) return {};
  const value = clampDay(day, ctx.min, ctx.max);
  const view = value.year !== ctx.focusedValue.year
    ? "year"
    : value.month !== ctx.focusedValue.month
    ? "month"
    : "day";
  return { focusedValue: value, view };
};

export const setView: DatePickerAssign<"VIEW.SET"> = (_ctx, event) => ({
  view: event.view === "month" || event.view === "year" ? event.view : "day",
});

export const hoverRangeDay: DatePickerAssign<"CELL.POINTER_MOVE"> = (ctx, event) => {
  if (ctx.startValue === null) return {};
  return { hoveredValue: clampDay(event.value, ctx.min, ctx.max) };
};

export const clearHover: DatePickerAssign<"TABLE.POINTER_LEAVE"> = () => ({
  hoveredValue: null,
});

export const isDayView: GuardFor<DatePickerContext, DatePickerEvents> = (ctx) => ctx.view === "day";

export const isAboveDayView: GuardFor<DatePickerContext, DatePickerEvents> = (ctx) =>
  ctx.view !== "day";

export const isRangePicker: GuardFor<DatePickerContext, DatePickerEvents> = (ctx) =>
  ctx.selectionMode === "range";

export const isMultiPicker: GuardFor<DatePickerContext, DatePickerEvents> = (ctx) =>
  ctx.selectionMode === "multiple";

export const isSelfClosingSelection: GuardFor<DatePickerContext, DatePickerEvents> = (ctx) =>
  ctx.closeOnSelect;
