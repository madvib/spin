import type { AssignFor, GuardFor } from "@spin/runtime/fsm";
import type { DateInputEvents } from "./date-input.events.ts";
import type { DateInputContext, DateInputField } from "./date-input.state.ts";
import { clampField } from "./date-input.state.ts";
import {
  advance,
  clearEnteredKeys,
  clampValue,
  commit,
  dateToFields,
  daysInMonth,
  emptyFields,
  FIELD_LIMITS,
  fieldWidth,
  fieldsToDate,
  parseValue,
  periodOf,
  segmentFields,
  setActiveSegment,
  setPrevSegment,
  valueAsString,
} from "./date-input.state.ts";

type DateInputAssign<K extends keyof DateInputEvents = keyof DateInputEvents> = AssignFor<
  DateInputContext,
  DateInputEvents,
  K
>;

export const setValue: DateInputAssign<"VALUE.SET"> = (ctx, e) => {
  if (e.type !== "VALUE.SET") return {};
  const named =
    typeof e.value === "string"
      ? parseValue(e.value)
      : e.value === null
        ? null
        : (e.value as DateInputContext["value"]);
  if (typeof e.value === "string" && valueAsString(ctx.value) === valueAsString(named)) {
    return {};
  }
  const value = clampValue(named, ctx.min, ctx.max);
  return { value, fields: dateToFields(value, ctx.hourCycle), enteredKeys: "" };
};

export const clearValue: DateInputAssign<"VALUE.CLEAR"> = () => ({
  value: null,
  fields: emptyFields(),
  enteredKeys: "",
});

export const setHourCycle: DateInputAssign<"HOUR_CYCLE.SET"> = (ctx, e) => {
  if (e.type !== "HOUR_CYCLE.SET") return {};
  return { hourCycle: e.hourCycle, fields: dateToFields(ctx.value, e.hourCycle) };
};

export const focusSegment: DateInputAssign<"SEGMENT.FOCUS"> = setActiveSegment;

export const isSameSegmentFocus: GuardFor<DateInputContext, DateInputEvents> = (ctx, e) =>
  e.type === "SEGMENT.FOCUS" && e.index === ctx.activeSegment;

export const blurSegment: DateInputAssign<"SEGMENT.BLUR"> = (ctx) => {
  const value = clampValue(fieldsToDate(ctx.fields, ctx.hourCycle), ctx.min, ctx.max);
  if (value === null) return { activeSegment: -1, enteredKeys: "" };
  return { activeSegment: -1, enteredKeys: "", value, fields: dateToFields(value, ctx.hourCycle) };
};

export const inputSegment: DateInputAssign<"SEGMENT.INPUT"> = (ctx, e) => {
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
  if (keys.length === width && keys.startsWith("0") && field !== "year") {
    const short = Number.parseInt(keys.slice(1), 10);
    if (!Number.isNaN(short)) return { fields: { ...next, [field]: short }, enteredKeys: keys };
  }
  return advance(next, ctx, e.index, fields);
};

export const adjustSegment: DateInputAssign<"SEGMENT.ADJUST"> = (ctx, e) => {
  if (e.type !== "SEGMENT.ADJUST") return {};
  const fields = segmentFields(ctx.granularity);
  const field = fields[e.index];
  if (field === undefined) return {};
  const limits =
    field === "day"
      ? { min: 1, max: daysInMonth(ctx.fields.year, ctx.fields.month) }
      : FIELD_LIMITS[field];
  const current = ctx.fields[field];
  const at = current ?? (e.amount > 0 ? limits.max : limits.min);
  const span = limits.max - limits.min + 1;
  const cycled = limits.min + (((at - limits.min + e.amount) % span + span) % span);
  const next = { ...ctx.fields, [field]: clampField(field, cycled, ctx.fields.year, ctx.fields.month) };
  return { ...commit(next, ctx), enteredKeys: "" };
};

export const arrowLeft: DateInputAssign<"SEGMENT.ARROW_LEFT"> = (ctx) => ({
  activeSegment: Math.max(0, ctx.activeSegment - 1),
  enteredKeys: "",
});

export const arrowRight: DateInputAssign<"SEGMENT.ARROW_RIGHT"> = (ctx) => ({
  activeSegment: Math.min(segmentFields(ctx.granularity).length - 1, ctx.activeSegment + 1),
  enteredKeys: "",
});

export const backspaceEmpty: GuardFor<DateInputContext, DateInputEvents> = (ctx) => {
  if (ctx.enteredKeys !== "") return false;
  const fields = segmentFields(ctx.granularity);
  const field = fields[ctx.activeSegment];
  return field === undefined || ctx.fields[field] === null;
};

export const backspacePrev: DateInputAssign<"SEGMENT.BACKSPACE"> = (ctx) => ({
  activeSegment: Math.max(0, ctx.activeSegment - 1),
  enteredKeys: "",
});

export const backspaceClear: DateInputAssign<"SEGMENT.BACKSPACE"> = (ctx) => {
  const fields = segmentFields(ctx.granularity);
  const field = fields[ctx.activeSegment];
  if (field === undefined) return {};
  return { ...commit({ ...ctx.fields, [field]: null }, ctx), enteredKeys: "" };
};

export const homeSegment: DateInputAssign<"SEGMENT.HOME"> = (ctx) => {
  const fields = segmentFields(ctx.granularity);
  const field = fields[ctx.activeSegment];
  if (field === undefined) return {};
  const value = field === "day" ? 1 : FIELD_LIMITS[field].min;
  return {
    ...commit({ ...ctx.fields, [field]: clampField(field, value, ctx.fields.year, ctx.fields.month) }, ctx),
    enteredKeys: "",
  };
};

export const endSegment: DateInputAssign<"SEGMENT.END"> = (ctx) => {
  const fields = segmentFields(ctx.granularity);
  const field = fields[ctx.activeSegment];
  if (field === undefined) return {};
  const value = field === "day" ? daysInMonth(ctx.fields.year, ctx.fields.month) : FIELD_LIMITS[field].max;
  return {
    ...commit({ ...ctx.fields, [field]: clampField(field, value, ctx.fields.year, ctx.fields.month) }, ctx),
    enteredKeys: "",
  };
};

export const pasteSegment: DateInputAssign<"SEGMENT.PASTE"> = (ctx, e) => {
  if (e.type !== "SEGMENT.PASTE") return {};
  const time = Date.parse(e.value);
  if (Number.isNaN(time)) return {};
  const at = new Date(time);
  const value: DateInputContext["value"] = {
    year: at.getUTCFullYear(),
    month: at.getUTCMonth() + 1,
    day: at.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  };
  const clamped = clampValue(value, ctx.min, ctx.max);
  return { value: clamped, fields: dateToFields(clamped, ctx.hourCycle), enteredKeys: "" };
};
