import {
  clampValue,
  getNextStepValue,
  getPreviousStepValue,
} from "@zag-js/utils";
import type { EventUnion } from "@spin/runtime/fsm";
import type { SliderEvents } from "./slider.events.ts";
import type { SliderContext } from "./slider.state.ts";
import {
  closestIndex,
  constrain,
  handlePush,
  isInteractive,
  movableIndex,
  normalizeAll,
  rangeAt,
  resolveNone,
} from "./slider.state.ts";

const incrementThumb = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "INCREMENT" && event.type !== "ARROW_INC") return {};
  const index = event.type === "INCREMENT" && event.index !== undefined ? event.index : ctx.focusedIndex;
  if (index < 0 || index >= ctx.value.length) return {};
  const range = rangeAt(ctx, index);
  const next = getNextStepValue(index, {
    ...range,
    step: event.step ?? ctx.step,
    values: [...ctx.value],
  }) as number[];
  next[index] = clampValue(next[index] ?? ctx.min, range.min, range.max) as number;
  return { value: next };
};

const decrementThumb = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "DECREMENT" && event.type !== "ARROW_DEC") return {};
  const index = event.type === "DECREMENT" && event.index !== undefined ? event.index : ctx.focusedIndex;
  if (index < 0 || index >= ctx.value.length) return {};
  const range = rangeAt(ctx, index);
  const next = getPreviousStepValue(index, {
    ...range,
    step: event.step ?? ctx.step,
    values: [...ctx.value],
  }) as number[];
  next[index] = clampValue(next[index] ?? ctx.min, range.min, range.max) as number;
  return { value: next };
};

const setClosestThumb = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "POINTER_DOWN") return {};
  return {
    focusedIndex: movableIndex(ctx.value, closestIndex(ctx.value, event.pointValue), ctx.max),
  };
};

const setFocusedIndex = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "FOCUS" && event.type !== "THUMB_POINTER_DOWN") return {};
  const asked = event.type === "FOCUS" && event.index !== undefined ? event.index : 0;
  const index = event.type === "THUMB_POINTER_DOWN" ? event.index : asked;
  void ctx;
  return { focusedIndex: index };
};

const clearFocusedIndex = (): Partial<SliderContext> => ({ focusedIndex: -1 });

const setDragOffset = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "THUMB_POINTER_DOWN") return {};
  void ctx;
  return { dragOffset: event.offset ?? null };
};

const snapshotDragStart = (ctx: SliderContext): Partial<SliderContext> => ({
  dragStartValue: [...ctx.value],
});

const clearDragRefs = (): Partial<SliderContext> => ({ dragOffset: null, dragStartValue: null });

const setPointerValue = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "POINTER_DOWN" && event.type !== "POINTER_MOVE") return {};
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

const hasIndex = (_ctx: SliderContext, event: EventUnion<SliderEvents>): boolean =>
  event.type === "SET_VALUE" && event.index !== undefined && event.index !== null;

const setIndexedValue = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "SET_VALUE" || event.index === undefined || event.index === null) return {};
  const values = [...event.value];
  if (values[event.index] === undefined) return {};
  const constrained = constrain(ctx, values[event.index] ?? ctx.min, event.index);
  const next = [...ctx.value];
  next[event.index] = constrained;
  return { value: next };
};

const setAllValues = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "SET_VALUE") return {};
  return { value: normalizeAll(ctx, [...event.value]) };
};

const setMin = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "SET_MIN") return {};
  void ctx;
  return { min: event.min };
};

const setMax = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "SET_MAX") return {};
  void ctx;
  return { max: event.max };
};

const setStep = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "SET_STEP") return {};
  void ctx;
  return { step: event.step };
};

const setDisabled = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "SET_DISABLED") return {};
  void ctx;
  return { disabled: event.disabled === true };
};

const setReadOnly = (ctx: SliderContext, event: EventUnion<SliderEvents>): Partial<SliderContext> => {
  if (event.type !== "SET_READ_ONLY") return {};
  void ctx;
  return { readOnly: event.readOnly === true };
};

const setHomeValue = (ctx: SliderContext): Partial<SliderContext> => {
  if (ctx.focusedIndex < 0) return {};
  const next = [...ctx.value];
  next[ctx.focusedIndex] = rangeAt(ctx, ctx.focusedIndex).min;
  return { value: next };
};

const setEndValue = (ctx: SliderContext): Partial<SliderContext> => {
  if (ctx.focusedIndex < 0) return {};
  const next = [...ctx.value];
  next[ctx.focusedIndex] = rangeAt(ctx, ctx.focusedIndex).max;
  return { value: next };
};

export {
  clearDragRefs,
  clearFocusedIndex,
  decrementThumb,
  incrementThumb,
  setAllValues,
  hasIndex,
  setClosestThumb,
  setDisabled,
  setDragOffset,
  setEndValue,
  setFocusedIndex,
  setHomeValue,
  setIndexedValue,
  setMax,
  setMin,
  setPointerValue,
  setReadOnly,
  setStep,
  snapshotDragStart,
};

export { isInteractive };
