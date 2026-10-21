/** Slider machine: idle/focus/dragging over three states. */

import {
  clampValue,
  getNextStepValue,
  getPercentValue,
  getPreviousStepValue,
  getValuePercent,
  getValueRanges,
  snapValueToStep,
} from "../../../../node_modules/@zag-js/utils/dist/number.mjs";
import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion } from "@spin/runtime/fsm";
const incrementThumb = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
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

const decrementThumb = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
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

const setClosestThumb = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
        if (event.type !== "POINTER_DOWN") return {};
        return {
          focusedIndex: movableIndex(ctx.value, closestIndex(ctx.value, event.pointValue), ctx.max),
        };
      };

const setFocusedIndex = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
        if (event.type !== "FOCUS" && event.type !== "THUMB_POINTER_DOWN") return {};
        const asked = event.type === "FOCUS" && event.index !== undefined ? event.index : 0;
        const index = event.type === "THUMB_POINTER_DOWN" ? event.index : asked;
        void ctx;
        return { focusedIndex: index };
      };

const clearFocusedIndex = () : Partial<SliderContext> => { return ({ focusedIndex: -1 }); };

const setDragOffset = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
        if (event.type !== "THUMB_POINTER_DOWN") return {};
        void ctx;
        return { dragOffset: event.offset ?? null };
      };

const snapshotDragStart = (ctx: SliderContext) : Partial<SliderContext> => { return ({
        dragStartValue: [...ctx.value],
      }); };

const clearDragRefs = () : Partial<SliderContext> => { return ({ dragOffset: null, dragStartValue: null }); };

const setPointerValue = (ctx: SliderContext, event: EventUnion<SliderEvents>) : Partial<SliderContext> => {
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

export interface SliderEvents {
  "SET_VALUE": { value: readonly number[]; index?: number };
  "INCREMENT": { index?: number; step?: number };
  "DECREMENT": { index?: number; step?: number };
  "POINTER_DOWN": { pointValue: number };
  "THUMB_POINTER_DOWN": { index: number; offset?: number };
  "POINTER_MOVE": { pointValue: number };
  "POINTER_UP": {};
  "POINTER_CANCEL": {};
  "FOCUS": { index?: number };
  "BLUR": {};
  "ARROW_INC": { step?: number };
  "ARROW_DEC": { step?: number };
  "HOME": {};
  "END": {};
  "SET_MIN": { min: number };
  "SET_MAX": { max: number };
  "SET_STEP": { step: number };
  "SET_DISABLED": { disabled: boolean };
  "SET_READ_ONLY": { readOnly: boolean };
}

export type SliderEvent = EventUnion<SliderEvents>;

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

export function valuePercent(ctx: SliderContext): number[] {
  return ctx.value.map((value) => getValuePercent(value, ctx.min, ctx.max) as number);
}

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
  return (getValuePercent(value, ctx.min, ctx.max) as number) * 100;
}

export function valueOfPercent(ctx: SliderContext, percent: number): number {
  return getPercentValue(percent, ctx.min, ctx.max, ctx.step) as number;
}

const numProp = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const valuesProp = (raw: unknown): number[] | null => {
  if (Array.isArray(raw)) {
    return raw.every((item) => typeof item === "number" && Number.isFinite(item))
      ? [...(raw as number[])]
      : null;
  }
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) &&
        parsed.every((item) => typeof item === "number" && Number.isFinite(item))
      ? [...(parsed as number[])]
      : null;
  } catch {
    return null;
  }
};

/**
 * The slider's arguments: the values the host may set.
 *
 * The twin (`defaultValue`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live value.
 *
 * The wire types are the scope's own: the bounds are numbers, the rest
 * are the strings the scope declares.
 */
export interface SliderArgs {
  value?: string;
  min?: number;
  max?: number;
  step?: number;
  /** The coarse step (shift+arrow); absent means ten times the step. */
  largeStep?: string;
  /** The gap the thumbs keep, in steps. */
  minStepsBetweenThumbs?: string;
  origin?: string;
  orientation?: string;
  thumbCollisionBehavior?: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  markers?: string;
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
  // A host that wrote `defaultValue` wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const min = numProp(args.min) ?? 0;
  const max = numProp(args.max) ?? 100;
  const step = numProp(args.step) ?? 1;
  return {
    min,
    max,
    step,
    largeStep: numProp(args.largeStep) ?? 10 * step,
    minStepsBetweenThumbs: Math.max(
      0,
      Math.floor(numProp(args.minStepsBetweenThumbs) ?? 0),
    ),
    origin: args.origin === "center" || args.origin === "end"
      ? (args.origin as "center" | "end")
      : "start",
    orientation: args.orientation === "vertical" ? "vertical" : "horizontal",
    thumbCollisionBehavior:
      args.thumbCollisionBehavior === "push" ||
        args.thumbCollisionBehavior === "swap"
        ? (args.thumbCollisionBehavior as ThumbCollisionBehavior)
        : "none",
    disabled: args.disabled === true,
    readOnly: args.readOnly === true,
    invalid: args.invalid === true,
    value: written("value") ? valuesProp(args.value) ?? [min] : [min],
    markers: valuesProp(args.markers) ?? [],
    focusedIndex: -1,
    dragOffset: null,
    dragStartValue: null,
  };
}

export function slider(
  args: SliderArgs = {},
  authored: (name: string) => boolean,
): Machine<SliderContext, SliderEvents> {
  return createMachine<SliderContext, SliderEvents>({
    id: "slider",
    initial: "idle",
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
     */
    fields: {
      value: { event: "SET_VALUE" },
      min: {},
      max: {},
      step: {},
      largeStep: {},
      minStepsBetweenThumbs: {},
      origin: {},
      orientation: {},
      thumbCollisionBehavior: {},
      disabled: {},
      readOnly: {},
      invalid: {},
    },
    on: {
      SET_VALUE: [
        { cond: (_ctx, event) => { return event.type === "SET_VALUE" && event.index !== undefined && event.index !== null; }, assign: (ctx, event) => {
        if (event.type !== "SET_VALUE" || event.index === undefined || event.index === null) return {};
        const values = valuesProp(event.value);
        if (values === null) return {};
        const constrained = constrain(ctx, values[event.index] ?? ctx.min, event.index);
        const next = [...ctx.value];
        next[event.index] = constrained;
        return { value: next };
      } },
        { assign: (ctx, event) => {
        // The values arrive the way the host wrote them; the machine
        // shapes them.
        const values = valuesProp(event.value);
        if (values === null) return {};
        return { value: normalizeAll(ctx, values) };
      } },
      ],
      INCREMENT: { assign: incrementThumb },
      DECREMENT: { assign: decrementThumb },
      SET_MIN: { assign: (ctx, event) => {
        const min = numProp(event.min);
        if (min === null) return {};
        return { min };
      } },
      SET_MAX: { assign: (ctx, event) => {
        const max = numProp(event.max);
        if (max === null) return {};
        return { max };
      } },
      SET_STEP: { assign: (ctx, event) => {
        const step = numProp(event.step);
        if (step === null) return {};
        return { step };
      } },
      SET_DISABLED: { assign: (ctx, event) => {
        void ctx;
        return { disabled: event.disabled === true };
      } },
      SET_READ_ONLY: { assign: (ctx, event) => {
        void ctx;
        return { readOnly: event.readOnly === true };
      } },
    },
    states: {
      idle: {
        on: {
          POINTER_DOWN: {
            target: "dragging",
            assign: [setClosestThumb, snapshotDragStart, setPointerValue],
          },
          FOCUS: {
            target: "focus",
            cond: (ctx) => { return isInteractive(ctx); },
            assign: setFocusedIndex,
          },
          THUMB_POINTER_DOWN: {
            target: "dragging",
            assign: [setFocusedIndex, setDragOffset, snapshotDragStart],
          },
        },
      },
      focus: {
        on: {
          POINTER_DOWN: {
            target: "dragging",
            assign: [setClosestThumb, snapshotDragStart, setPointerValue],
          },
          THUMB_POINTER_DOWN: {
            target: "dragging",
            assign: [setFocusedIndex, setDragOffset, snapshotDragStart],
          },
          ARROW_DEC: { assign: decrementThumb },
          ARROW_INC: { assign: incrementThumb },
          HOME: { assign: (ctx) => {
        if (ctx.focusedIndex < 0) return {};
        const next = [...ctx.value];
        next[ctx.focusedIndex] = rangeAt(ctx, ctx.focusedIndex).min;
        return { value: next };
      } },
          END: { assign: (ctx) => {
        if (ctx.focusedIndex < 0) return {};
        const next = [...ctx.value];
        next[ctx.focusedIndex] = rangeAt(ctx, ctx.focusedIndex).max;
        return { value: next };
      } },
          BLUR: { target: "idle", assign: clearFocusedIndex },
        },
      },
      dragging: {
        on: {
          POINTER_UP: {
            target: "focus",
            assign: clearDragRefs,
          },
          POINTER_MOVE: { assign: setPointerValue },
          POINTER_CANCEL: {
            target: "idle",
            assign: [clearFocusedIndex, clearDragRefs],
          },
        },
      },
    },});
}
