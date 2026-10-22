import {
  clampValue,
  getNextStepValue,
  getPreviousStepValue,
} from "@spin/runtime";
import type { EventOf, EventUnion } from "@spin/runtime/fsm";
import type { SliderEvents } from "./slider.events.ts";
import type { SliderContext } from "./slider.state.ts";
import {
  closestIndex,
  constrain,
  handlePush,
  movableIndex,
  normalizeAll,
  rangeAt,
  resolveNone,
} from "./slider.state.ts";

export const incrementThumb = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "INCREMENT"> | EventOf<SliderEvents, "ARROW_INC">,
): Partial<SliderContext> => {
  const index = event.type === "INCREMENT" && event.index !== undefined ? event.index : ctx.focusedIndex;
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

export const decrementThumb = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "DECREMENT"> | EventOf<SliderEvents, "ARROW_DEC">,
): Partial<SliderContext> => {
  const index = event.type === "DECREMENT" && event.index !== undefined ? event.index : ctx.focusedIndex;
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

export const setClosestThumb = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "POINTER_DOWN">,
): Partial<SliderContext> => {
  return {
    focusedIndex: movableIndex(ctx.value, closestIndex(ctx.value, event.pointValue), ctx.max),
  };
};

export const setFocusedIndex = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "FOCUS"> | EventOf<SliderEvents, "THUMB_POINTER_DOWN">,
): Partial<SliderContext> => {
  const asked = event.type === "FOCUS" && event.index !== undefined ? event.index : 0;
  const index = event.type === "THUMB_POINTER_DOWN" ? event.index : asked;
  void ctx;
  return { focusedIndex: index };
};

export const clearFocusedIndex = (): Partial<SliderContext> => ({ focusedIndex: -1 });

export const setDragOffset = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "THUMB_POINTER_DOWN">,
): Partial<SliderContext> => {
  void ctx;
  return { dragOffset: event.offset ?? null };
};

export const snapshotDragStart = (ctx: SliderContext): Partial<SliderContext> => ({
  dragStartValue: [...ctx.value],
});

export const clearDragRefs = (): Partial<SliderContext> => ({ dragOffset: null, dragStartValue: null });

export const setPointerValue = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "POINTER_DOWN"> | EventOf<SliderEvents, "POINTER_MOVE">,
): Partial<SliderContext> => {
  if (ctx.thumbCollisionBehavior === "push") {
    const gap = ctx.step * ctx.minStepsBetweenThumbs;
    const pushed = handlePush(ctx.focusedIndex, event.pointValue, ctx.value, ctx.min, ctx.max, gap);
    return { value: pushed.values, focusedIndex: pushed.index };
  }
  const resolved = resolveNone(
    ctx.focusedIndex,
    event.pointValue,
    ctx.value,
    ctx.min,
    ctx.max,
  );
  return { value: resolved.values };
};

export const hasIndex = (_ctx: SliderContext, event: EventUnion<SliderEvents>): boolean =>
  event.type === "SET_VALUE" && event.index !== undefined && event.index !== null;

export const setIndexedValue = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "SET_VALUE">,
): Partial<SliderContext> => {
  const values = [...event.value];
  if (event.index === undefined || event.index === null) return {};
  if (values[event.index] === undefined) return {};
  const constrained = constrain(ctx, values[event.index] ?? ctx.min, event.index);
  const next = [...ctx.value];
  next[event.index] = constrained;
  return { value: next };
};

export const setAllValues = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "SET_VALUE">,
): Partial<SliderContext> => {
  return { value: normalizeAll(ctx, [...event.value]) };
};

export const setMin = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "SET_MIN">,
): Partial<SliderContext> => {
  void ctx;
  return { min: event.min };
};

export const setMax = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "SET_MAX">,
): Partial<SliderContext> => {
  void ctx;
  return { max: event.max };
};

export const setStep = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "SET_STEP">,
): Partial<SliderContext> => {
  void ctx;
  return { step: event.step };
};

export const setDisabled = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "SET_DISABLED">,
): Partial<SliderContext> => {
  void ctx;
  return { disabled: event.disabled === true };
};

export const setReadOnly = (
  ctx: SliderContext,
  event: EventOf<SliderEvents, "SET_READ_ONLY">,
): Partial<SliderContext> => {
  void ctx;
  return { readOnly: event.readOnly === true };
};

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

