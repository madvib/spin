import type { AssignFor, GuardFor } from "@spinjs/runtime/fsm";
import type { NumberInputContext } from "./number-input.state.ts";
import type { NumberInputEvent } from "./number-input.events.ts";
import type {
  NumberInputEvents,
  NumberInputHint,
} from "./number-input.events.ts";
import {
  clampValue,
  decrementValue,
  formatValue,
  incrementValue,
  isValueWithinRange,
  parseValue,
} from "./number-input.state.ts";

type NumberInputAssign<
  K extends keyof NumberInputEvents = keyof NumberInputEvents,
> = AssignFor<
  NumberInputContext,
  NumberInputEvents,
  K
>;

export const increment: NumberInputAssign<
  | "VALUE.INCREMENT"
  | "INPUT.ARROW_UP"
  | "TRIGGER.PRESS_DOWN"
  | "SCRUBBER.POINTER_MOVE"
  | "SPIN"
> = (ctx, event) => {
  const step = "step" in event ? event.step : undefined;
  const op = incrementValue;
  const next = op(parseValue(ctx.value), step ?? ctx.step);
  const bounded = ctx.allowOverflow ? next : clampValue(next, ctx.min, ctx.max);
  return { value: formatValue(bounded) };
};

export const decrement: NumberInputAssign<
  | "VALUE.DECREMENT"
  | "INPUT.ARROW_DOWN"
  | "TRIGGER.PRESS_DOWN"
  | "SCRUBBER.POINTER_MOVE"
  | "SPIN"
> = (ctx, event) => {
  const step = "step" in event ? event.step : undefined;
  const next = decrementValue(parseValue(ctx.value), step ?? ctx.step);
  const bounded = ctx.allowOverflow ? next : clampValue(next, ctx.min, ctx.max);
  return { value: formatValue(bounded) };
};

export const setFormattedValue: NumberInputAssign<
  "INPUT.BLUR" | "INPUT.ENTER"
> = (ctx) => ({
  value: formatValue(parseValue(ctx.value)),
});

export const beginSpin: NumberInputAssign<"TRIGGER.PRESS_DOWN"> = (
  _ctx,
  event,
) => ({
  hint: event.type === "TRIGGER.PRESS_DOWN" ? event.hint : null,
  spin: "hold",
});

export const endSpin = (): Partial<NumberInputContext> => ({
  hint: null,
  spin: null,
});

export const clearHint = (): Partial<NumberInputContext> => ({
  hint: null,
});

export const setCursorPoint = (
  _ctx: NumberInputContext,
  event: NumberInputEvent,
): Partial<NumberInputContext> => {
  const point = "point" in event ? event.point : undefined;
  return point === undefined ? {} : { cursorPoint: point };
};

export const moved = (
  ctx: NumberInputContext,
  event: NumberInputEvent,
  op: (value: number, step: number) => number,
): Partial<NumberInputContext> => {
  const step = "step" in event ? event.step ?? ctx.step : ctx.step;
  const next = op(parseValue(ctx.value), step);
  const bounded = ctx.allowOverflow ? next : clampValue(next, ctx.min, ctx.max);
  return { value: formatValue(bounded) };
};

// guards
export const isIncrementHint: GuardFor<NumberInputContext, NumberInputEvents> =
  (ctx, event) =>
    ("hint" in event
      ? (event as { hint?: NumberInputHint }).hint
      : ctx.hint) === "increment";

export const isDecrementHint: GuardFor<NumberInputContext, NumberInputEvents> =
  (ctx, event) =>
    ("hint" in event
      ? (event as { hint?: NumberInputHint }).hint
      : ctx.hint) === "decrement";

export const outOfRange = (ctx: NumberInputContext): boolean =>
  !isValueWithinRange(parseValue(ctx.value), ctx.min, ctx.max);
