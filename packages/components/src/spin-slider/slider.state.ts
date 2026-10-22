import {
  clampValue,
  getPercentValue,
  getValuePercent,
  getValueRanges,
  snapValueToStep,
} from "@spin/runtime";

export type ThumbCollisionBehavior = "none" | "push" | "swap";

export interface SliderContext {
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
  /** The pointer grab offset from the thumb center. */
  dragOffset: number | null;
  /** The values when the drag started: swap compares against the grab. */
  dragStartValue: number[] | null;
  /** Marker stops for the ticks/marks usages: view data, seeded from the
   * `markers` prop. */
  markers: number[];
}

/**
 * The slider's arguments: the machine's own domain types. The host sets
 * typed values; nothing parses text here.
 *
 * The twin (`defaultValue`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live value.
 */
export interface SliderArgs {
  value?: readonly number[];
  min?: number;
  max?: number;
  step?: number;
  /** The coarse step (shift+arrow); absent means ten times the step. */
  largeStep?: number;
  /** The gap the thumbs keep, in steps. */
  minStepsBetweenThumbs?: number;
  origin?: "start" | "center" | "end";
  orientation?: "horizontal" | "vertical";
  thumbCollisionBehavior?: ThumbCollisionBehavior;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  markers?: readonly number[];
  defaultInvalid?: boolean;
}

/**
 * The machine's context, built from its arguments: what the args did not
 * carry takes the machine's own default.
 *
 * The seed twin (`defaultValue`) is the host's write of the value — the
 * framework resolved it into the args — so it counts as a write too.
 */
export function initial(args: SliderArgs = {}, authored: (name: string) => boolean): SliderContext {
  // Presence is the evidence: the map drops absent fields, so a field
  // present in the args was provided — by the host directly, or resolved
  // from its twin upstream. The machine's own default owns absence.
  const written = (field: string): boolean =>
    (args as Record<string, unknown>)[field] !== undefined || authored(field);
  const min = args.min ?? 0;
  const max = args.max ?? 100;
  const step = args.step ?? 1;
  const valueOf = (raw: readonly number[] | undefined, fallback: number[]): number[] =>
    raw === undefined ? fallback : [...raw];
  return {
    min,
    max,
    step,
    largeStep: args.largeStep ?? 10 * step,
    minStepsBetweenThumbs: Math.max(
      0,
      Math.floor(args.minStepsBetweenThumbs ?? 0),
    ),
    origin: args.origin ?? "start",
    orientation: args.orientation ?? "horizontal",
    thumbCollisionBehavior: args.thumbCollisionBehavior ?? "none",
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    invalid: args.invalid === true,
    value: written("value") ? valueOf(args.value, [min]) : [min],
    markers: valueOf(args.markers, []),
    focusedIndex: -1,
    dragOffset: null,
    dragStartValue: null,
  };
}

export function valuePercent(ctx: SliderContext): number[] {
  return ctx.value.map((value) => getValuePercent(value, ctx.min, ctx.max));
}

function rangeAt(
  ctx: SliderContext,
  index: number,
): { readonly min: number; readonly max: number; readonly value: number } {
  const ranges = getValueRanges(
    ctx.value,
    ctx.min,
    ctx.max,
    ctx.step * ctx.minStepsBetweenThumbs,
  );
  return ranges[index] ?? { min: ctx.min, max: ctx.max, value: ctx.value[index] ?? ctx.min };
}

function constrain(ctx: SliderContext, value: number, index: number): number {
  const range = rangeAt(ctx, index);
  const snapped = snapValueToStep(value, ctx.min, ctx.max, ctx.step);
  return clampValue(snapped, range.min, range.max);
}

function normalizeAll(ctx: SliderContext, next: readonly number[]): number[] {
  return next.map((value, index) => constrain({ ...ctx, value: [...ctx.value] }, value, index));
}

function resolveNone(
  index: number,
  value: number,
  values: number[],
  min: number,
  max: number,
): { values: number[]; index: number; swapped: boolean } {
  if (values.length === 1) {
    return { values: [clampValue(value, min, max)], index: 0, swapped: false };
  }
  const next = [...values];
  next[index] = clampValue(value, min, max);
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
  const clamped = clampValue(value, min, max);
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
  return { values: next.map((v) => clampValue(v, min, max)), index, swapped: false };
}

/** Later thumbs win ties. */
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

/** Stacked thumbs at max move the first one. */
export function movableIndex(values: readonly number[], index: number, max: number): number {
  if ((values[index] ?? 0) !== max) return index;
  let movable = index;
  while (movable > 0 && values[movable - 1] === max) movable -= 1;
  return movable;
}

export function thumbRange(
  ctx: SliderContext,
  index: number,
): { min: number; max: number } {
  return rangeAt(ctx, index);
}

export function percentOf(ctx: SliderContext, value: number): number {
  return (getValuePercent(value, ctx.min, ctx.max)) * 100;
}

export function valueOfPercent(ctx: SliderContext, percent: number): number {
  return getPercentValue(percent, ctx.min, ctx.max, ctx.step);
}

export { constrain, handlePush, normalizeAll, rangeAt, resolveNone };
