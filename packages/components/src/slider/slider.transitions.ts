import {
  clampValue,
  closestIndex,
  getNextStepValue,
  getPreviousStepValue,
} from "@spinjs/components/runtime";
import type { AssignFor, GuardFor } from "@spinjs/components/fsm";
import type { SliderEvents } from "./slider.events.ts";
import type { SliderContext } from "./slider.state.ts";
import {
  constrain,
  handlePush,
  movableIndex,
  normalizeAll,
  rangeAt,
  resolveNone,
} from "./slider.state.ts";

type SliderAssign<K extends keyof SliderEvents = keyof SliderEvents> =
  AssignFor<
    SliderContext,
    SliderEvents,
    K
  >;

export const incrementThumb: SliderAssign<"INCREMENT" | "ARROW_INC"> = (
  ctx,
  event,
) => {
  const index = event.type === "INCREMENT" && event.index !== undefined
    ? event.index
    : ctx.focusedIndex;
  if (index < 0 || index >= ctx.value.length) return {};
  const range = rangeAt(ctx, index);
  const next = [...getNextStepValue(index, {
    ...range,
    step: event.step ?? ctx.step,
    values: [...ctx.value],
  })];
  next[index] = clampValue(next[index] ?? ctx.min, range.min, range.max);
  return { value: next };
};

export const decrementThumb: SliderAssign<"DECREMENT" | "ARROW_DEC"> = (
  ctx,
  event,
) => {
  const index = event.type === "DECREMENT" && event.index !== undefined
    ? event.index
    : ctx.focusedIndex;
  if (index < 0 || index >= ctx.value.length) return {};
  const range = rangeAt(ctx, index);
  const next = [...getPreviousStepValue(index, {
    ...range,
    step: event.step ?? ctx.step,
    values: [...ctx.value],
  })];
  next[index] = clampValue(next[index] ?? ctx.min, range.min, range.max);
  return { value: next };
};

export const setClosestThumb: SliderAssign<"POINTER_DOWN"> = (ctx, event) => ({
  focusedIndex: movableIndex(
    ctx.value,
    closestIndex(ctx.value, event.pointValue),
    ctx.max,
  ),
});

export const setFocusedIndex: SliderAssign<"FOCUS" | "THUMB_POINTER_DOWN"> = (
  _ctx,
  event,
) => ({
  focusedIndex: event.type === "THUMB_POINTER_DOWN"
    ? event.index
    : (event.index ?? 0),
});

export const clearFocusedIndex = (): Partial<SliderContext> => ({
  focusedIndex: -1,
});

export const setPointerValue: SliderAssign<"POINTER_DOWN" | "POINTER_MOVE"> = (
  ctx,
  event,
) => {
  if (ctx.thumbCollisionBehavior === "push") {
    const gap = ctx.step * ctx.minStepsBetweenThumbs;
    return {
      value: handlePush(
        ctx.focusedIndex,
        event.pointValue,
        ctx.value,
        ctx.min,
        ctx.max,
        gap,
      ),
    };
  }
  return {
    value: resolveNone(
      ctx.focusedIndex,
      event.pointValue,
      ctx.value,
      ctx.min,
      ctx.max,
    ),
  };
};

export const hasIndex: GuardFor<SliderContext, SliderEvents> = (_ctx, event) =>
  event.type === "SET_VALUE" && event.index !== undefined &&
  event.index !== null;

export const setIndexedValue: SliderAssign<"SET_VALUE"> = (ctx, event) => {
  const values = [...event.value];
  if (event.index === undefined || event.index === null) return {};
  if (values[event.index] === undefined) return {};
  const next = [...ctx.value];
  next[event.index] = constrain(
    ctx,
    values[event.index] ?? ctx.min,
    event.index,
  );
  return { value: next };
};

export const setAllValues: SliderAssign<"SET_VALUE"> = (ctx, event) => ({
  value: normalizeAll(ctx, [...event.value]),
});

export const setHomeValue = (ctx: SliderContext): Partial<SliderContext> => {
  if (ctx.focusedIndex < 0) return {};
  const next = [...ctx.value];
  next[ctx.focusedIndex] = rangeAt(ctx, ctx.focusedIndex).min;
  return { value: next };
};

export const setEndValue = (ctx: SliderContext): Partial<SliderContext> => {
  if (ctx.focusedIndex < 0) return {};
  const next = [...ctx.value];
  next[ctx.focusedIndex] = rangeAt(ctx, ctx.focusedIndex).max;
  return { value: next };
};
