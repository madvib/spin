/**
 * Slider machine: idle/focus/dragging over Zag's three states.
 *
 * The value math is Zag's pure `@zag-js/utils` number module (imported
 * directly — no DOM in that module, only scalars); the thumb-collision
 * resolution is Zag's own `slider.utils`, vendored below because it calls
 * back into those same scalars. The machine owns no math of its own.
 *
 * Context stays serializable for the scope channel: values, the focused
 * index, and the scalars the assigns read. Guards sit where Zag put them:
 * SET_VALUE with an index constrains the one thumb, keyboard only drives
 * a focused slider, a drag release lands in focus, a cancel lands in idle.
 */

import {
  clampValue,
  getNextStepValue,
  getPercentValue,
  getPreviousStepValue,
  getValuePercent,
  getValueRanges,
  snapValueToStep,
} from "../../../../node_modules/@zag-js/utils/dist/number.mjs";

export type ThumbCollisionBehavior = "none" | "push" | "swap";

export interface SliderContext {
  /** The thumb values, in order. */
  value: number[];
  focusedIndex: number;
  min: number;
  max: number;
  step: number;
  largeStep: number;
  minStepsBetweenThumbs: number;
  origin: "start" | "center" | "end";
  orientation: "horizontal" | "vertical";
  thumbCollisionBehavior: ThumbCollisionBehavior;
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean;
  /** The pointer grab offset from the thumb center. Refs in Zag, plain
   * context here because the fork has no ref tier and it is a value. */
  dragOffset: number | null;
  /** The values when the drag started: swap compares against the grab. */
  dragStartValue: number[] | null;
  /**
   * Marker stops for the ticks/marks usages. View data, seeded from the
   * `markers` prop; the machine never reads or writes it.
   */
  markers: number[];
}

export type SliderEvent =
  | { type: "SET_VALUE"; value: readonly number[]; index?: number }
  | { type: "INCREMENT"; index?: number; step?: number }
  | { type: "DECREMENT"; index?: number; step?: number }
  | { type: "POINTER_DOWN"; pointValue: number }
  | { type: "THUMB_POINTER_DOWN"; index: number; offset?: number }
  | { type: "POINTER_MOVE"; pointValue: number }
  | { type: "POINTER_UP" }
  | { type: "POINTER_CANCEL" }
  | { type: "FOCUS"; index?: number }
  | { type: "BLUR" }
  | { type: "ARROW_INC"; step?: number }
  | { type: "ARROW_DEC"; step?: number }
  | { type: "HOME" }
  | { type: "END" }
  | { type: "SET_MIN"; min: number }
  | { type: "SET_MAX"; max: number }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_DISABLED"; disabled: boolean }
  | { type: "SET_READ_ONLY"; readOnly: boolean };

export type SliderValueChange = {
  readonly value: number[];
};

export type SliderFocusChange = {
  readonly focusedIndex: number;
  readonly value: number[];
};

export type SliderValueChangeEnd = {
  readonly value: number[];
};

export function isInteractive(ctx: SliderContext): boolean {
  return !ctx.readOnly && !ctx.disabled;
}

/** Zag's valuePercent, pure: each thumb as a 0..1 fraction of the track. */
export function valuePercent(ctx: SliderContext): number[] {
  return ctx.value.map((value) => getValuePercent(value, ctx.min, ctx.max) as number);
}

/** The per-thumb clamp window: neighbors plus the between-thumbs gap. */
function rangeAt(ctx: SliderContext, index: number): { min: number; max: number } {
  const ranges = getValueRanges(
    ctx.value,
    ctx.min,
    ctx.max,
    ctx.step * ctx.minStepsBetweenThumbs,
  ) as { min: number; max: number }[];
  return ranges[index] ?? { min: ctx.min, max: ctx.max };
}

function constrain(ctx: SliderContext, value: number, index: number): number {
  const range = rangeAt(ctx, index);
  const snapped = snapValueToStep(value, ctx.min, ctx.max, ctx.step) as number;
  return clampValue(snapped, range.min, range.max) as number;
}

function normalizeAll(ctx: SliderContext, next: readonly number[]): number[] {
  return next.map((value, index) => constrain({ ...ctx, value: [...ctx.value] }, value, index));
}

/** Zag's single-thumb fast path: no collision possible. */
function resolveNone(
  index: number,
  value: number,
  values: number[],
  min: number,
  max: number,
): { values: number[]; index: number; swapped: boolean } {
  if (values.length === 1) {
    return { values: [clampValue(value, min, max) as number], index: 0, swapped: false };
  }
  const next = [...values];
  next[index] = clampValue(value, min, max) as number;
  return { values: next, index, swapped: false };
}

const round10 = (value: number): number => Math.round(value * 1e10) / 1e10;

function handlePush(
  index: number,
  value: number,
  values: number[],
  min: number,
  max: number,
  gap: number,
): { values: number[]; index: number; swapped: boolean } {
  const next = [...values];
  const clamped = clampValue(value, min, max) as number;
  next[index] = clamped;
  // Push neighbors apart so the gap holds: walk outward from the moved
  // thumb, shoving each neighbor that intrudes.
  for (let i = index; i > 0; i -= 1) {
    const upper = next[i] ?? max;
    if ((next[i - 1] ?? min) > upper - gap) next[i - 1] = round10(upper - gap);
  }
  for (let i = index; i < next.length - 1; i += 1) {
    const lower = next[i] ?? min;
    if ((next[i + 1] ?? max) < lower + gap) next[i + 1] = round10(lower + gap);
  }
  return { values: next.map((v) => clampValue(v, min, max) as number), index, swapped: false };
}

/** Zag's getClosestIndex, pure: later thumbs win ties. */
export function closestIndex(values: readonly number[], pointValue: number): number {
  let closest = 0;
  let distance = Math.abs((values[0] ?? 0) - pointValue);
  for (let i = 1; i < values.length; i += 1) {
    const next = Math.abs((values[i] ?? 0) - pointValue);
    if (next <= distance) {
      closest = i;
      distance = next;
    }
  }
  return closest;
}

/** Zag's selectMovableThumb: stacked thumbs at max move the first one. */
export function movableIndex(values: readonly number[], index: number, max: number): number {
  if ((values[index] ?? 0) !== max) return index;
  let movable = index;
  while (movable > 0 && values[movable - 1] === max) movable -= 1;
  return movable;
}

/** The aria window the thumb reports: its clamp range. */
export function thumbRange(
  ctx: SliderContext,
  index: number,
): { min: number; max: number } {
  return rangeAt(ctx, index);
}

/** Percent of the track for one value: the geometry channel's input. */
export function percentOf(ctx: SliderContext, value: number): number {
  return (getValuePercent(value, ctx.min, ctx.max) as number) * 100;
}

/** A track percent back to a stepped value: the pointer path's input. */
export function valueOfPercent(ctx: SliderContext, percent: number): number {
  return getPercentValue(percent, ctx.min, ctx.max, ctx.step) as number;
}

export const config = {
  id: "slider",
  initial: "idle",
  context: {
    value: [0],
    focusedIndex: -1,
    min: 0,
    max: 100,
    step: 1,
    largeStep: 10,
    minStepsBetweenThumbs: 0,
    origin: "start" as "start" | "center" | "end",
    orientation: "horizontal" as "horizontal" | "vertical",
    thumbCollisionBehavior: "none" as ThumbCollisionBehavior,
    disabled: false,
    readOnly: false,
    invalid: false,
    // The pointer grab offset and the drag-start snapshot: refs in Zag,
    // plain context here because the fork has no ref tier and both are
    // serializable values.
    dragOffset: null as number | null,
    dragStartValue: null as number[] | null,
    markers: [] as number[],
  },
  on: {
    SET_VALUE: [
      { cond: "hasIndex", actions: [{ assign: "setValueAtIndex" }] },
      { actions: [{ assign: "setValue" }] },
    ],
    INCREMENT: { actions: [{ assign: "incrementThumb" }] },
    DECREMENT: { actions: [{ assign: "decrementThumb" }] },
    SET_MIN: { actions: [{ assign: "setMin" }] },
    SET_MAX: { actions: [{ assign: "setMax" }] },
    SET_STEP: { actions: [{ assign: "setStep" }] },
    SET_DISABLED: { actions: [{ assign: "setDisabled" }] },
    SET_READ_ONLY: { actions: [{ assign: "setReadOnly" }] },
  },
  states: {
    idle: {
      on: {
        POINTER_DOWN: {
          target: "dragging",
          actions: [
            { assign: "setClosestThumb" },
            { assign: "snapshotDragStart" },
            { assign: "setPointerValue" },
          ],
        },
        FOCUS: {
          target: "focus",
          cond: "interactive",
          actions: [{ assign: "setFocusedIndex" }],
        },
        THUMB_POINTER_DOWN: {
          target: "dragging",
          actions: [
            { assign: "setFocusedIndex" },
            { assign: "setDragOffset" },
            { assign: "snapshotDragStart" },
          ],
        },
      },
    },
    focus: {
      on: {
        POINTER_DOWN: {
          target: "dragging",
          actions: [
            { assign: "setClosestThumb" },
            { assign: "snapshotDragStart" },
            { assign: "setPointerValue" },
          ],
        },
        THUMB_POINTER_DOWN: {
          target: "dragging",
          actions: [
            { assign: "setFocusedIndex" },
            { assign: "setDragOffset" },
            { assign: "snapshotDragStart" },
          ],
        },
        ARROW_DEC: { actions: [{ assign: "decrementThumb" }] },
        ARROW_INC: { actions: [{ assign: "incrementThumb" }] },
        HOME: { actions: [{ assign: "setFocusedThumbToMin" }] },
        END: { actions: [{ assign: "setFocusedThumbToMax" }] },
        BLUR: { target: "idle", actions: [{ assign: "clearFocusedIndex" }] },
      },
    },
    dragging: {
      on: {
        POINTER_UP: {
          target: "focus",
          actions: [{ assign: "clearDragRefs" }],
        },
        POINTER_MOVE: { actions: [{ assign: "setPointerValue" }] },
        POINTER_CANCEL: {
          target: "idle",
          actions: [{ assign: "clearFocusedIndex" }, { assign: "clearDragRefs" }],
        },
      },
    },
  },
};

export const implementations = {
  conds: {
    interactive: (ctx: SliderContext): boolean => isInteractive(ctx),
    hasIndex: (_ctx: SliderContext, event: SliderEvent): boolean =>
      event.type === "SET_VALUE" && event.index !== undefined && event.index !== null,
  },
  assigns: {
    setValue: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "SET_VALUE") return {};
      return { value: normalizeAll(ctx, event.value) };
    },
    setValueAtIndex: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "SET_VALUE" || event.index === undefined || event.index === null) return {};
      const constrained = constrain(ctx, event.value[event.index] ?? ctx.min, event.index);
      const next = [...ctx.value];
      next[event.index] = constrained;
      return { value: next };
    },
    incrementThumb: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
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
    },
    decrementThumb: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
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
    },
    setFocusedThumbToMin: (ctx: SliderContext): Partial<SliderContext> => {
      if (ctx.focusedIndex < 0) return {};
      const next = [...ctx.value];
      next[ctx.focusedIndex] = rangeAt(ctx, ctx.focusedIndex).min;
      return { value: next };
    },
    setFocusedThumbToMax: (ctx: SliderContext): Partial<SliderContext> => {
      if (ctx.focusedIndex < 0) return {};
      const next = [...ctx.value];
      next[ctx.focusedIndex] = rangeAt(ctx, ctx.focusedIndex).max;
      return { value: next };
    },
    setClosestThumb: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "POINTER_DOWN") return {};
      return {
        focusedIndex: movableIndex(ctx.value, closestIndex(ctx.value, event.pointValue), ctx.max),
      };
    },
    setFocusedIndex: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "FOCUS" && event.type !== "THUMB_POINTER_DOWN") return {};
      const asked = event.type === "FOCUS" && event.index !== undefined ? event.index : 0;
      const index = event.type === "THUMB_POINTER_DOWN" ? event.index : asked;
      void ctx;
      return { focusedIndex: index };
    },
    clearFocusedIndex: (): Partial<SliderContext> => ({ focusedIndex: -1 }),
    setDragOffset: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "THUMB_POINTER_DOWN") return {};
      void ctx;
      return { dragOffset: event.offset ?? null };
    },
    snapshotDragStart: (ctx: SliderContext): Partial<SliderContext> => ({
      dragStartValue: [...ctx.value],
    }),
    clearDragRefs: (): Partial<SliderContext> => ({ dragOffset: null, dragStartValue: null }),
    // The pointer path: closest thumb already chosen, collision resolved
    // against the drag-start snapshot so a swap compares to where the
    // thumbs were grabbed, not where they have drifted.
    setPointerValue: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
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
    },
    setMin: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "SET_MIN") return {};
      void ctx;
      return { min: event.min };
    },
    setMax: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "SET_MAX") return {};
      void ctx;
      return { max: event.max };
    },
    setStep: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "SET_STEP") return {};
      void ctx;
      return { step: event.step };
    },
    setDisabled: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "SET_DISABLED") return {};
      void ctx;
      return { disabled: event.disabled };
    },
    setReadOnly: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "SET_READ_ONLY") return {};
      void ctx;
      return { readOnly: event.readOnly };
    },
  },
};
