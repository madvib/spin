/** Number-input machine: chart only. */

import { createMachine, type Machine } from "@spin/runtime/fsm";
import type {
  NumberInputArgs,
  NumberInputContext,
  NumberInputState,
} from "./number-input.state.ts";
import {
  asNumber,
  clampValue,
  formatValue,
  initial,
  parseValue,
} from "./number-input.state.ts";
import type { NumberInputEvents } from "./number-input.events.ts";
import {
  beginSpin,
  clearHint,
  decrement,
  endSpin,
  increment,
  isDecrementHint,
  isIncrementHint,
  outOfRange,
  setCursorPoint,
  setFormattedValue,
} from "./number-input.transitions.ts";

export function numberInput(
  args: NumberInputArgs = {},
  authored: (name: string) => boolean = () => true,
): Machine<NumberInputContext, NumberInputEvents, NumberInputState> {
  return createMachine<NumberInputContext, NumberInputEvents, NumberInputState>(
    {
      id: "number-input",
      initial: "idle",
      context: initial(args, authored),
      on: {
        "VALUE.SET": {
          assign: (ctx, event) => {
            // The host's own text is authoritative: a written string lands
            // verbatim, and only a numeric set takes the range.
            if (typeof event.value === "string") return { value: event.value };
            if (typeof event.value !== "number") return {};
            const raw = event.value;
            return {
              value: formatValue(
                ctx.allowOverflow ? raw : clampValue(raw, ctx.min, ctx.max),
              ),
            };
          },
        },
        "VALUE.CLEAR": { assign: () => ({ value: "" }) },
        "VALUE.INCREMENT": { assign: increment },
        "VALUE.DECREMENT": { assign: decrement },
        "FIELDSET.DISABLED": {
          assign: (
            _ctx,
            event,
          ) => (event.type === "FIELDSET.DISABLED"
            ? { fieldsetDisabled: event.value }
            : {}),
        },
        "CHANGE_DELAY": [
          {
            cond: (ctx) => ctx.spinOnPress && !outOfRange(ctx),
            assign: () => ({ spin: "repeat" }),
          },
          { assign: endSpin },
        ],
        "SPIN": [
          { cond: isIncrementHint, assign: increment },
          { cond: isDecrementHint, assign: decrement },
        ],
      },
      states: {
        idle: {
          on: {
            "TRIGGER.PRESS_DOWN": [
              {
                target: "focused",
                cond: isDecrementHint,
                assign: [beginSpin, decrement],
              },
              {
                target: "focused",
                cond: isIncrementHint,
                assign: [beginSpin, increment],
              },
            ],
            "SCRUBBER.PRESS_DOWN": {
              target: "scrubbing",
              assign: setCursorPoint,
            },
            "INPUT.FOCUS": { target: "focused" },
          },
        },
        focused: {
          on: {
            "TRIGGER.PRESS_DOWN": [
              {
                target: "focused",
                cond: isDecrementHint,
                assign: [beginSpin, decrement],
              },
              {
                target: "focused",
                cond: isIncrementHint,
                assign: [beginSpin, increment],
              },
            ],
            "SCRUBBER.PRESS_DOWN": {
              target: "scrubbing",
              assign: setCursorPoint,
            },
            "TRIGGER.PRESS_UP": { assign: endSpin },
            "INPUT.ARROW_UP": { assign: increment },
            "INPUT.ARROW_DOWN": { assign: decrement },
            "INPUT.HOME": {
              assign: (ctx) => ({ value: formatValue(ctx.min) }),
            },
            "INPUT.END": { assign: (ctx) => ({ value: formatValue(ctx.max) }) },
            "INPUT.CHANGE": {
              assign: (
                _ctx,
                event,
              ) => (event.type === "INPUT.CHANGE"
                ? { value: event.value }
                : {}),
            },
            "INPUT.BLUR": [
              {
                target: "idle",
                cond: (ctx) =>
                  ctx.clampValueOnBlur && ctx.value !== "" && outOfRange(ctx),
                assign: [
                  (ctx) => ({
                    value: formatValue(
                      clampValue(parseValue(ctx.value), ctx.min, ctx.max),
                    ),
                  }),
                  clearHint,
                ],
              },
              {
                target: "idle",
                cond: outOfRange,
                assign: [setFormattedValue, clearHint],
              },
              {
                target: "idle",
                assign: [setFormattedValue, clearHint],
              },
            ],
            "INPUT.ENTER": { assign: [setFormattedValue, clearHint] },
          },
        },
        scrubbing: {
          on: {
            "SCRUBBER.POINTER_UP": {
              target: "focused",
              assign: () => ({ cursorPoint: null }),
            },
            "SCRUBBER.POINTER_MOVE": [
              { cond: isIncrementHint, assign: [increment, setCursorPoint] },
              { cond: isDecrementHint, assign: [decrement, setCursorPoint] },
            ],
          },
        },
      },
      fields: {
        value: { event: "VALUE.SET" },
        min: { parse: (raw) => asNumber(raw, Number.MIN_SAFE_INTEGER) },
        max: { parse: (raw) => asNumber(raw, Number.MAX_SAFE_INTEGER) },
        step: { parse: (raw) => asNumber(raw, 1) },
        largeStep: { parse: (raw) => asNumber(raw, 10) },
        smallStep: { parse: (raw) => asNumber(raw, 0.1) },
        allowOverflow: {},
        allowMouseWheel: {},
        focusInputOnChange: {},
        clampValueOnBlur: {},
        spinOnPress: {},
        disabled: {},
        readOnly: {},
        required: {},
        invalid: {},
        dir: {},
        inputMode: {},
        pattern: {},
        name: {},
        form: {},
        incrementLabel: {},
        decrementLabel: {},
        initialValue: {},
      },
    },
  );
}
