import { createMachine, type Machine } from "@spinjs/components/fsm";
import type {
  DatePickerArgs,
  DatePickerContext,
  DatePickerState,
} from "./date-picker.state.ts";
import { daysOf, initial, normalizeDays } from "./date-picker.state.ts";
import type { DatePickerEvents } from "./date-picker.events.ts";
import {
  clearHover,
  clearValue,
  drillIntoView,
  hoverRangeDay,
  isAboveDayView,
  isDayView,
  isMultiPicker,
  isRangePicker,
  isSelfClosingSelection,
  resetView,
  selectRangeDay,
  selectSingleDay,
  setFocusAboveDay,
  setFocusDay,
  setValue,
  setView,
  toggleMultiDay,
} from "./date-picker.transitions.ts";

export type {
  DatePickerArgs,
  DatePickerContext,
  DatePickerState,
} from "./date-picker.state.ts";
export type { DatePickerEvents } from "./date-picker.events.ts";
export {
  type DatePickerSelectionMode,
  type DatePickerValue,
  type DatePickerView,
} from "./date-picker.state.ts";

export function datePicker(
  args: DatePickerArgs = {},
  authored: (name: string) => boolean,
): Machine<DatePickerContext, DatePickerEvents, DatePickerState> {
  return createMachine<DatePickerContext, DatePickerEvents, DatePickerState>({
    id: "date-picker",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      value: { event: "VALUE.SET" },
      focusedValue: { event: "FOCUS.SET" },
      view: { event: "VIEW.SET" },
      selectionMode: {},
      numOfMonths: {},
      min: {},
      max: {},
      closeOnSelect: {},
      disabled: {},
      readOnly: {},
      invalid: {},
      startOfWeek: {},
      dir: {},
      label: {},
      locale: {},
      placeholder: {},
      format: {},
    },
    on: {
      "VALUE.SET": {
        assign: (ctx, e) => setValue(ctx, e) as Partial<DatePickerContext>,
      },
      "VALUE.CLEAR": { assign: clearValue },
      "FOCUS.SET": [
        {
          cond: isDayView,
          assign: (ctx, e) => setFocusDay(ctx, e) as Partial<DatePickerContext>,
        },
        {
          assign: (ctx, e) =>
            setFocusAboveDay(ctx, e) as Partial<DatePickerContext>,
        },
      ],
      "VIEW.SET": {
        assign: (ctx, e) => setView(ctx, e) as Partial<DatePickerContext>,
      },
    },
    states: {
      idle: {
        on: {
          "OPEN": [{ target: "open", assign: resetView }],
        },
      },
      focused: {
        on: {
          "OPEN": [{ target: "open", assign: resetView }],
        },
      },
      open: {
        on: {
          "CLOSE": [{ target: "focused" }],
          "CLOSE.OUTSIDE": [{ target: "idle" }],
          "CELL.CLICK": [
            {
              cond: isAboveDayView,
              assign: (ctx, e) =>
                drillIntoView(ctx, e) as Partial<DatePickerContext>,
            },
            {
              cond: isRangePicker,
              assign: (ctx, e) =>
                selectRangeDay(ctx, e) as Partial<DatePickerContext>,
            },
            {
              cond: isMultiPicker,
              assign: (ctx, e) =>
                toggleMultiDay(ctx, e) as Partial<DatePickerContext>,
            },
            {
              cond: isSelfClosingSelection,
              target: "focused",
              assign: (ctx, e) =>
                selectSingleDay(ctx, e) as Partial<DatePickerContext>,
            },
            {
              assign: (ctx, e) =>
                selectSingleDay(ctx, e) as Partial<DatePickerContext>,
            },
          ],
          "CELL.POINTER_MOVE": [
            {
              cond: isRangePicker,
              assign: (ctx, e) =>
                hoverRangeDay(ctx, e) as Partial<DatePickerContext>,
            },
          ],
          "TABLE.POINTER_LEAVE": [{ assign: clearHover }],
          "TABLE.ENTER": [
            {
              cond: isAboveDayView,
              assign: (ctx, e) =>
                drillIntoView(ctx, e) as Partial<DatePickerContext>,
            },
            {
              cond: isRangePicker,
              assign: (ctx, e) =>
                selectRangeDay(ctx, e) as Partial<DatePickerContext>,
            },
            {
              cond: isMultiPicker,
              assign: (ctx, e) =>
                toggleMultiDay(ctx, e) as Partial<DatePickerContext>,
            },
            {
              cond: isSelfClosingSelection,
              target: "focused",
              assign: (ctx, e) =>
                selectSingleDay(ctx, e) as Partial<DatePickerContext>,
            },
            {
              assign: (ctx, e) =>
                selectSingleDay(ctx, e) as Partial<DatePickerContext>,
            },
          ],
          "TABLE.ESCAPE": [{ target: "focused" }],
        },
      },
    },
  });
}

export { daysOf, normalizeDays };
