/** Date-input machine: the field values, the focused segment, and the keys typed into it. */

import { createMachine, type Machine } from "@spinjs/runtime/fsm";
import type { DateInputArgs, DateInputContext } from "./date-input.state.ts";
import { clearEnteredKeys, initial } from "./date-input.state.ts";
import type { DateInputEvents } from "./date-input.events.ts";
import type { DateInputState } from "./date-input.state.ts";
import {
  adjustSegment,
  arrowLeft,
  arrowRight,
  backspaceClear,
  backspaceEmpty,
  backspacePrev,
  blurSegment,
  clearValue,
  endSegment,
  focusSegment,
  homeSegment,
  inputSegment,
  isSameSegmentFocus,
  pasteSegment,
  setHourCycle,
  setValue,
} from "./date-input.transitions.ts";

export type { DateInputState };

export function dateInput(
  args: DateInputArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<DateInputContext, DateInputEvents, DateInputState> {
  return createMachine<DateInputContext, DateInputEvents, DateInputState>({
    id: "date-input",
    initial: "idle",
    context: initial(args, authored),
    on: {
      "VALUE.SET": { assign: setValue },
      "VALUE.CLEAR": { assign: clearValue },
      "HOUR_CYCLE.SET": { assign: setHourCycle },
    },
    states: {
      idle: {
        on: {
          "SEGMENT.FOCUS": { target: "focused", assign: focusSegment },
        },
      },
      focused: {
        on: {
          "SEGMENT.FOCUS": [
            { cond: isSameSegmentFocus, assign: focusSegment },
            { assign: [focusSegment, clearEnteredKeys] },
          ],
          "SEGMENT.BLUR": { target: "idle", assign: blurSegment },
          "SEGMENT.INPUT": { assign: inputSegment },
          "SEGMENT.ADJUST": { assign: [adjustSegment, clearEnteredKeys] },
          "SEGMENT.ARROW_LEFT": { assign: [arrowLeft, clearEnteredKeys] },
          "SEGMENT.ARROW_RIGHT": { assign: [arrowRight, clearEnteredKeys] },
          "SEGMENT.BACKSPACE": [
            { cond: backspaceEmpty, assign: [backspacePrev, clearEnteredKeys] },
            { assign: backspaceClear },
          ],
          "SEGMENT.HOME": { assign: [homeSegment, clearEnteredKeys] },
          "SEGMENT.END": { assign: [endSegment, clearEnteredKeys] },
          "SEGMENT.PASTE": { assign: [pasteSegment, clearEnteredKeys] },
        },
      },
    },
    fields: {
      value: { event: "VALUE.SET" },
      granularity: {},
      hourCycle: {},
      min: {},
      max: {},
      dir: {},
      disabled: {},
      readOnly: {},
      invalid: {},
      required: {},
      name: {},
      form: {},
    },
  });
}
