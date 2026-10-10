/**
 * Slider machine: the config and its vocabulary — states, events, guards and
 * pure assigns. The value model is Zag's (a value per thumb, per-index
 * ranges, step snapping, thumb collision). What is NOT here: pointer
 * geometry (the connect turns a point into a value) and every DOM effect
 * (focus, drag listeners) — those are the view's, per the runsheet.
 */

export type ThumbCollisionBehavior = "none" | "push" | "swap";

export interface SliderValueChange {
  readonly value: readonly number[];
}
export interface SliderFocusChange {
  readonly focusedIndex: number;
  readonly value: readonly number[];
}

export interface SliderContext {
  value: number[];
  focusedIndex: number;
  /** Values at the moment a drag started — what `swap` compares against. */
  dragStartValue: number[] | null;
  /** Props the assigns read, synced from scope by the bridge. `largeStep` is
   * absent on purpose: no assign reads it — the keyboard step size is the
   * view's, computed in the connect from the same prop. */
  min: number;
  max: number;
  step: number;
  minStepsBetweenThumbs: number;
  thumbCollisionBehavior: ThumbCollisionBehavior;
}

export type SliderEvent =
  | { type: "SET_VALUE"; value: readonly number[]; index?: undefined }
  | { type: "SET_VALUE"; value: number; index: number }
  | { type: "INCREMENT"; index?: number; step?: number }
  | { type: "DECREMENT"; index?: number; step?: number }
  | { type: "ARROW_INC"; index?: number; step?: number }
  | { type: "ARROW_DEC"; index?: number; step?: number }
  | { type: "HOME" }
  | { type: "END" }
  | { type: "FOCUS"; index: number }
  | { type: "BLUR" }
  | { type: "THUMB_POINTER_DOWN"; index: number }
  | { type: "POINTER_DOWN"; value: number }
  | { type: "POINTER_MOVE"; value: number }
  | { type: "POINTER_UP" }
  | { type: "POINTER_CANCEL" };

/** Events after which a value change counts as finished — Zag fires
 * `onValueChangeEnd` for exactly these. */
export const COMMITTING_EVENTS: Readonly<Partial<Record<SliderEvent["type"], true>>> = {
  SET_VALUE: true,
  INCREMENT: true,
  DECREMENT: true,
  ARROW_INC: true,
  ARROW_DEC: true,
  HOME: true,
  END: true,
  POINTER_UP: true,
};

// --------------------------------------------------------------------- math

/** Float dust stepping produces (0.30000000000000004), rounded away. */
const round = (value: number): number => Math.round(value * 1e10) / 1e10;

const clampValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Number.isNaN(value) ? 0 : value, min), max);

const roundToStepPrecision = (value: number, step: number): number => {
  const point = step.toString().indexOf(".");
  const digits = point >= 0 ? step.toString().length - point : 0;
  return digits > 0 ? Math.round(value * 10 ** digits) / 10 ** digits : value;
};

const snapValueToStep = (
  value: number,
  min: number,
  max: number,
  step: number,
): number => {
  const remainder = (value - min) % step;
  let snapped = Math.abs(remainder) * 2 >= step
    ? value + Math.sign(remainder) * (step - Math.abs(remainder))
    : value - remainder;
  snapped = roundToStepPrecision(snapped, step);
  if (snapped < min) {
    snapped = min;
  } else if (snapped > max) {
    const stepsInRange = Math.floor((max - min) / step);
    const largestValidStep = min + stepsInRange * step;
    snapped = stepsInRange <= 0 || largestValidStep < min ? max : largestValidStep;
  }
  return roundToStepPrecision(snapped, step);
};

/** The value a percent of the range lands on, snapped to the step grid. */
export const percentToValue = (
  percent: number,
  min: number,
  max: number,
  step: number,
): number => {
  const raw = clampValue(percent, 0, 1) * (max - min) + min;
  const rounded = Math.round((raw - min) / step) * step + min;
  return clampValue(roundToStepPrecision(rounded, step), min, max);
};

/** The percent of the range a value sits at. */
export const valueToPercent = (value: number, min: number, max: number): number =>
  (value - min) / (max - min);

interface ValueRange {
  readonly min: number;
  readonly max: number;
}

/** Per-thumb bounds: the neighbour, inset by the gap, else the range end. */
const thumbRanges = (
  values: readonly number[],
  min: number,
  max: number,
  gap: number,
): readonly ValueRange[] =>
  values.map((_value, index) => {
    const prev = values[index - 1];
    const next = values[index + 1];
    return {
      min: prev !== undefined ? prev + gap : min,
      max: next !== undefined ? next - gap : max,
    };
  });

/** The nearest thumb to a point value; on a tie the LATER thumb wins. */
const closestThumbIndex = (values: readonly number[], pointValue: number): number => {
  let closest = 0;
  let distance = Math.abs((values[0] ?? 0) - pointValue);
  for (let i = 1; i < values.length; i++) {
    const candidate = Math.abs((values[i] ?? 0) - pointValue);
    if (candidate <= distance) {
      closest = i;
      distance = candidate;
    }
  }
  return closest;
};

/** A thumb parked at the max cannot be picked: the leftmost of them can. */
const selectMovableThumb = (
  values: readonly number[],
  index: number,
  max: number,
): number => {
  if (values[index] !== max) return index;
  let movable = index;
  while (movable > 0 && values[movable - 1] === max) movable -= 1;
  return movable;
};

interface CollisionResult {
  readonly values: number[];
  readonly index: number;
  readonly swapped: boolean;
}

const resolveNone = (
  index: number,
  value: number,
  values: readonly number[],
  min: number,
  max: number,
  gap: number,
): CollisionResult => {
  const range = thumbRanges(values, min, max, gap)[index] ?? { min, max };
  const next = [...values];
  next[index] = round(clampValue(value, range.min, range.max));
  return { values: next, index, swapped: false };
};

const resolvePush = (
  index: number,
  value: number,
  values: readonly number[],
  min: number,
  max: number,
  gap: number,
): CollisionResult => {
  const next = [...values];
  const absoluteMin = min + index * gap;
  const absoluteMax = max - (values.length - 1 - index) * gap;
  next[index] = round(clampValue(value, absoluteMin, absoluteMax));
  for (let i = index + 1; i < values.length; i++) {
    const minAllowed = (next[i - 1] ?? min) + gap;
    if ((next[i] ?? min) < minAllowed) next[i] = round(minAllowed);
  }
  for (let i = index - 1; i >= 0; i--) {
    const maxAllowed = (next[i + 1] ?? max) - gap;
    if ((next[i] ?? max) > maxAllowed) next[i] = round(maxAllowed);
  }
  return { values: next, index, swapped: false };
};

const resolveSwap = (
  index: number,
  value: number,
  values: readonly number[],
  min: number,
  max: number,
  gap: number,
  startValue: number | undefined,
): CollisionResult => {
  const prev = values[index - 1];
  const next = values[index + 1];
  const start = startValue ?? values[index] ?? 0;
  const crossingNext = next !== undefined && value >= next && value > start;
  const crossingPrev = prev !== undefined && value <= prev && value < start;
  if (!crossingNext && !crossingPrev) {
    return resolveNone(index, value, values, min, max, gap);
  }
  const swapIndex = crossingNext ? index + 1 : index - 1;
  const nextValues = [...values];
  const range = thumbRanges(nextValues, min, max, gap)[swapIndex] ?? { min, max };
  const moved = round(clampValue(value, range.min, range.max));
  nextValues[swapIndex] = moved;
  nextValues[index] = values[swapIndex] ?? 0;
  if (crossingNext && (nextValues[index] ?? 0) > moved - gap) {
    nextValues[index] = round(moved - gap);
  } else if (crossingPrev && (nextValues[index] ?? 0) < moved + gap) {
    nextValues[index] = round(moved + gap);
  }
  return { values: nextValues, index: swapIndex, swapped: true };
};

/** Where a drag's value lands for one thumb, per the collision behavior. */
const resolveThumbCollision = (
  ctx: SliderContext,
  index: number,
  value: number,
): CollisionResult => {
  const { value: values, min, max, step, minStepsBetweenThumbs, thumbCollisionBehavior, dragStartValue } = ctx;
  if (values.length === 1) {
    return { values: [round(clampValue(value, min, max))], index: 0, swapped: false };
  }
  const gap = step * minStepsBetweenThumbs;
  const start = dragStartValue?.[index];
  if (thumbCollisionBehavior === "push") return resolvePush(index, value, values, min, max, gap);
  if (thumbCollisionBehavior === "swap") {
    return resolveSwap(index, value, values, min, max, gap, start);
  }
  return resolveNone(index, value, values, min, max, gap);
};

/** A stepped value for one thumb: snapped to the grid, clamped to its range. */
const stepThumbValue = (
  ctx: SliderContext,
  index: number,
  step: number,
): number[] | null => {
  const current = ctx.value[index];
  if (index < 0 || index >= ctx.value.length || current === undefined) return null;
  const gap = ctx.step * ctx.minStepsBetweenThumbs;
  const range = thumbRanges(ctx.value, ctx.min, ctx.max, gap)[index] ?? { min: ctx.min, max: ctx.max };
  const snapped = snapValueToStep(current + step, range.min, range.max, ctx.step);
  const next = [...ctx.value];
  next[index] = clampValue(snapped, range.min, range.max);
  return next;
};

/** Zap `min`/`max`/`step` at seed time so a host's `defaultValue` outside the
 * range arrives legal rather than being clamped on the first interaction. */
export const normalizeValues = (
  values: readonly number[],
  min: number,
  max: number,
  step: number,
  minStepsBetweenThumbs: number,
): number[] => {
  const gap = step * minStepsBetweenThumbs;
  return thumbRanges(values, min, max, gap).map((range, index) => {
    const current = values[index] ?? min;
    return clampValue(snapValueToStep(current, min, max, step), range.min, range.max);
  });
};

// ------------------------------------------------------------------- config

export const config = {
  id: "slider",
  initial: "idle",
  context: {
    value: [] as number[],
    focusedIndex: -1,
    dragStartValue: null as number[] | null,
    min: 0,
    max: 100,
    step: 1,
    minStepsBetweenThumbs: 0,
    thumbCollisionBehavior: "none" as ThumbCollisionBehavior,
  },
  // Root tier: programmatic value writes work from every state, including
  // mid-drag — the host's setValue must not depend on where focus sits.
  on: {
    SET_VALUE: [
      { cond: "hasIndex", actions: [{ assign: "setThumbValue" }] },
      { actions: [{ assign: "setValue" }] },
    ],
    INCREMENT: { actions: [{ assign: "stepThumb" }] },
    DECREMENT: { actions: [{ assign: "stepThumb" }] },
  },
  states: {
    idle: {
      on: {
        FOCUS: { target: "focus", actions: [{ assign: "focusThumb" }] },
        POINTER_DOWN: {
          target: "dragging",
          actions: [
            { assign: "captureDragStart" },
            { assign: "setClosestThumbIndex" },
            { assign: "setPointerValue" },
          ],
        },
        THUMB_POINTER_DOWN: {
          target: "dragging",
          actions: [{ assign: "focusThumb" }, { assign: "captureDragStart" }],
        },
      },
    },
    focus: {
      on: {
        BLUR: { target: "idle", actions: [{ assign: "clearFocusedIndex" }] },
        ARROW_INC: { actions: [{ assign: "stepThumb" }] },
        ARROW_DEC: { actions: [{ assign: "stepThumb" }] },
        HOME: { actions: [{ assign: "setFocusedThumbToMin" }] },
        END: { actions: [{ assign: "setFocusedThumbToMax" }] },
        POINTER_DOWN: {
          target: "dragging",
          actions: [
            { assign: "captureDragStart" },
            { assign: "setClosestThumbIndex" },
            { assign: "setPointerValue" },
          ],
        },
        THUMB_POINTER_DOWN: {
          target: "dragging",
          actions: [{ assign: "focusThumb" }, { assign: "captureDragStart" }],
        },
      },
    },
    dragging: {
      on: {
        POINTER_UP: { target: "focus", actions: [{ assign: "clearDragStart" }] },
        POINTER_MOVE: { actions: [{ assign: "setPointerValue" }] },
        POINTER_CANCEL: {
          target: "idle",
          actions: [{ assign: "clearFocusedIndex" }, { assign: "clearDragStart" }],
        },
      },
    },
  },
};

// ----------------------------------------------------------- implementations

/** The thumb an event addresses: its own index, else the focused one. */
const indexOf = (ctx: SliderContext, event: SliderEvent): number => {
  if (event.type === "FOCUS" || event.type === "THUMB_POINTER_DOWN") return event.index;
  const index = "index" in event ? event.index : undefined;
  return index ?? ctx.focusedIndex;
};

export const implementations = {
  conds: {
    hasIndex: (_ctx: SliderContext, event: SliderEvent) =>
      event.type === "SET_VALUE" && event.index !== undefined,
  },
  assigns: {
    setThumbValue: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "SET_VALUE" || event.index === undefined) return {};
      const index = event.index;
      const range = thumbRanges(ctx.value, ctx.min, ctx.max, ctx.step * ctx.minStepsBetweenThumbs)[index];
      if (!range) return {};
      const next = [...ctx.value];
      next[index] = clampValue(snapValueToStep(event.value, ctx.min, ctx.max, ctx.step), range.min, range.max);
      return { value: next };
    },
    setValue: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> =>
      event.type === "SET_VALUE" && event.index === undefined
        ? { value: normalizeValues(event.value, ctx.min, ctx.max, ctx.step, ctx.minStepsBetweenThumbs) }
        : {},
    // INCREMENT, DECREMENT, ARROW_INC and ARROW_DEC share this assign: they
    // carry the same shape, so no assign here needs to know which fired.
    stepThumb: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      const step = ("step" in event ? event.step : undefined) ?? ctx.step;
      const direction = event.type === "DECREMENT" || event.type === "ARROW_DEC" ? -1 : 1;
      if (step <= 0) return {};
      const next = stepThumbValue(ctx, indexOf(ctx, event), direction * step);
      return next === null ? {} : { value: next };
    },
    focusThumb: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> =>
      ({ focusedIndex: indexOf(ctx, event) }),
    clearFocusedIndex: (): Partial<SliderContext> => ({ focusedIndex: -1 }),
    captureDragStart: (ctx: SliderContext): Partial<SliderContext> => ({ dragStartValue: [...ctx.value] }),
    clearDragStart: (): Partial<SliderContext> => ({ dragStartValue: null }),
    setClosestThumbIndex: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "POINTER_DOWN") return {};
      const movable = selectMovableThumb(ctx.value, closestThumbIndex(ctx.value, event.value), ctx.max);
      return { focusedIndex: movable };
    },
    setPointerValue: (ctx: SliderContext, event: SliderEvent): Partial<SliderContext> => {
      if (event.type !== "POINTER_DOWN" && event.type !== "POINTER_MOVE") return {};
      const result = resolveThumbCollision(ctx, ctx.focusedIndex, event.value);
      return result.swapped
        ? { value: result.values, focusedIndex: result.index }
        : { value: result.values };
    },
    setFocusedThumbToMin: (ctx: SliderContext): Partial<SliderContext> => {
      const index = ctx.focusedIndex;
      const range = thumbRanges(ctx.value, ctx.min, ctx.max, ctx.step * ctx.minStepsBetweenThumbs)[index];
      if (!range) return {};
      const next = [...ctx.value];
      next[index] = range.min;
      return { value: next };
    },
    setFocusedThumbToMax: (ctx: SliderContext): Partial<SliderContext> => {
      const index = ctx.focusedIndex;
      const range = thumbRanges(ctx.value, ctx.min, ctx.max, ctx.step * ctx.minStepsBetweenThumbs)[index];
      if (!range) return {};
      const next = [...ctx.value];
      next[index] = range.max;
      return { value: next };
    },
  },
};
