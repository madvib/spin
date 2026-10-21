/** Number-input machine: the value, its range, and the spin/scrub gesture. */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export type NumberInputHint = "increment" | "decrement";

/** A viewport point, in client coordinates. */
export interface NumberInputPoint {
  readonly x: number;
  readonly y: number;
}

export interface NumberInputContext {
  value: string;
  hint: NumberInputHint | null;
  /** The scrubber's virtual cursor, wrapped inside the viewport. */
  cursorPoint: NumberInputPoint | null;
  fieldsetDisabled: boolean;
  min: number;
  max: number;
  step: number;
  largeStep: number;
  smallStep: number;
  allowOverflow: boolean;
  clampValueOnBlur: boolean;
  spinOnPress: boolean;
  /** `hold` is the pre-repeat dwell; `repeat` is the auto-repeat. */
  spin: "hold" | "repeat" | null;
}

export type NumberInputEvent =
  | { type: "VALUE.SET"; value: number | string }
  | { type: "VALUE.CLEAR" }
  | { type: "VALUE.INCREMENT" }
  | { type: "VALUE.DECREMENT" }
  | { type: "TRIGGER.PRESS_DOWN"; hint: NumberInputHint }
  | { type: "TRIGGER.PRESS_UP" }
  | { type: "CHANGE_DELAY" }
  | { type: "SPIN" }
  | { type: "SCRUBBER.PRESS_DOWN"; point: NumberInputPoint }
  | { type: "SCRUBBER.POINTER_MOVE"; hint: NumberInputHint; point: NumberInputPoint }
  | { type: "SCRUBBER.POINTER_UP" }
  | { type: "INPUT.FOCUS" }
  | { type: "INPUT.BLUR" }
  | { type: "INPUT.CHANGE"; value: string }
  | { type: "INPUT.ARROW_UP"; step: number }
  | { type: "INPUT.ARROW_DOWN"; step: number }
  | { type: "INPUT.HOME" }
  | { type: "INPUT.END" }
  | { type: "INPUT.ENTER" }
  | { type: "FIELDSET.DISABLED"; value: boolean };

/**
 * The number-input's arguments: the values the host may set.
 *
 * The twin (`defaultValue`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live value.
 */
export interface NumberInputArgs {
  value?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  largeStep?: string | number;
  smallStep?: string | number;
  allowOverflow?: boolean;
  clampValueOnBlur?: boolean;
  spinOnPress?: boolean;
}

const MIN_SAFE = Number.MIN_SAFE_INTEGER;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const DEFAULT_STEP = 1;

/**
 * A number from the prop store. The scope grammar has no float type, so the
 * bounds and the step sizes arrive as decimal strings from an attribute and
 * as numbers from a framework; neither is trusted.
 */
export function asNumber(raw: unknown, fallback: number): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : fallback;
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * The machine's verbatim form of an authored value: the host's own text.
 * Zag's controlled bindable writes the prop as the host authored it — no
 * parse, no clamp, no format — so a controlled host owns every character
 * the field shows. A write that is not a value at all is null.
 */
export function valueOf(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw.toString();
  return null;
}

export type NumberInputScalarKey =
  | "min"
  | "max"
  | "step"
  | "largeStep"
  | "smallStep"
  | "allowOverflow"
  | "clampValueOnBlur"
  | "spinOnPress";

/**
 * The scalars, shaped from the arguments: the bounds and the three step
 * sizes are numbers, and the two step sizes derive from the step itself
 * when the host wrote none.
 */
export function numberInputScalars(
  args: NumberInputArgs,
): Pick<NumberInputContext, NumberInputScalarKey> {
  const step = asNumber(args.step, DEFAULT_STEP);
  return {
    min: asNumber(args.min, MIN_SAFE),
    max: asNumber(args.max, MAX_SAFE),
    step,
    largeStep: asNumber(args.largeStep, 10 * step),
    smallStep: asNumber(args.smallStep, step / 10),
    allowOverflow: args.allowOverflow === true,
    clampValueOnBlur: args.clampValueOnBlur !== false,
    spinOnPress: args.spinOnPress !== false,
  };
}

/**
 * The machine's context, from its arguments: the value the host wrote, the
 * scalars the assigns read, and the machine's own gesture state.
 */
export function initial(
  args: NumberInputArgs,
  authored: (name: string) => boolean = () => true,
): NumberInputContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    value: written("value") ? valueOf(args.value) ?? "" : "",
    hint: null,
    cursorPoint: null,
    fieldsetDisabled: false,
    ...numberInputScalars(args),
    spin: null,
  };
}

/**
 * A press always leaves `idle`: Zag's `before:spin` carries the focus tag, so
 * the machine is focused for the whole gesture whether or not the input took
 * DOM focus.
 */
const pressDown = [
  { target: "focused", cond: "isDecrementHint", actions: [{ assign: "beginSpin" }, { assign: "decrement" }] },
  { target: "focused", cond: "isIncrementHint", actions: [{ assign: "beginSpin" }, { assign: "increment" }] },
];

const scrubDown = { target: "scrubbing", actions: [{ assign: "setCursorPoint" }] };

const config = {
  id: "number-input",
  initial: "idle",
  context: {
    value: "",
    hint: null as NumberInputHint | null,
    cursorPoint: null as NumberInputPoint | null,
    fieldsetDisabled: false,
    min: Number.MIN_SAFE_INTEGER,
    max: Number.MAX_SAFE_INTEGER,
    step: 1,
    largeStep: 10,
    smallStep: 0.1,
    allowOverflow: false,
    clampValueOnBlur: true,
    spinOnPress: true,
    spin: null as "hold" | "repeat" | null,
  },
  // The value events are valid in every state: "setValue works whether or
  // not the input holds focus".
  on: {
    "VALUE.SET": { actions: [{ assign: "setValue" }] },
    "VALUE.CLEAR": { actions: [{ assign: "clearValue" }] },
    "VALUE.INCREMENT": { actions: [{ assign: "increment" }] },
    "VALUE.DECREMENT": { actions: [{ assign: "decrement" }] },
    "FIELDSET.DISABLED": { actions: [{ assign: "setFieldsetDisabled" }] },
    // The auto-repeat clock's two ticks, one per phase, valid from wherever
    // the gesture is live.
    "CHANGE_DELAY": [
      { cond: "canRepeat", actions: [{ assign: "startRepeat" }] },
      // A dwell that cannot earn a repeat ends the gesture: Zag leaves the
      // machine waiting for the press-up, with the repeat never armed.
      { actions: [{ assign: "endSpin" }] },
    ],
    "SPIN": [
      { cond: "isIncrementHint", actions: [{ assign: "increment" }] },
      { cond: "isDecrementHint", actions: [{ assign: "decrement" }] },
    ],
  },
  states: {
    idle: {
      on: {
        "TRIGGER.PRESS_DOWN": pressDown,
        "SCRUBBER.PRESS_DOWN": scrubDown,
        "INPUT.FOCUS": { target: "focused" },
      },
    },
    focused: {
      on: {
        "TRIGGER.PRESS_DOWN": pressDown,
        "SCRUBBER.PRESS_DOWN": scrubDown,
        "TRIGGER.PRESS_UP": { actions: [{ assign: "endSpin" }] },
        // The arrow keys step by the step the view derived from the
        // modifier keys; everything else steps by `step`.
        "INPUT.ARROW_UP": { actions: [{ assign: "increment" }] },
        "INPUT.ARROW_DOWN": { actions: [{ assign: "decrement" }] },
        "INPUT.HOME": { actions: [{ assign: "setToMin" }] },
        "INPUT.END": { actions: [{ assign: "setToMax" }] },
        // A typed value is stored verbatim: the input shows exactly what the
        // host wrote until a blur or Enter reformats it.
        "INPUT.CHANGE": { actions: [{ assign: "setInputValue" }] },
        "INPUT.BLUR": [
          {
            target: "idle",
            cond: "clampsOnBlur",
            actions: [{ assign: "setClampedValue" }, { assign: "clearHint" }],
          },
          {
            target: "idle",
            cond: "isOutOfRange",
            actions: [{ assign: "setFormattedValue" }, { assign: "clearHint" }],
          },
          {
            target: "idle",
            actions: [{ assign: "setFormattedValue" }, { assign: "clearHint" }],
          },
        ],
        "INPUT.ENTER": { actions: [{ assign: "setFormattedValue" }, { assign: "clearHint" }] },
      },
    },
    scrubbing: {
      on: {
        "SCRUBBER.POINTER_UP": { target: "focused", actions: [{ assign: "clearCursorPoint" }] },
        "SCRUBBER.POINTER_MOVE": [
          { cond: "isIncrementHint", actions: [{ assign: "increment" }, { assign: "setCursorPoint" }] },
          { cond: "isDecrementHint", actions: [{ assign: "decrement" }, { assign: "setCursorPoint" }] },
        ],
      },
    },
  },
};

export const parseValue = (raw: string): number => Number.parseFloat(raw);

export const formatValue = (value: number): string => (Number.isNaN(value) ? "" : value.toString());

export const isValueWithinRange = (value: number, min: number, max: number): boolean => {
  const at = Number.isNaN(value) ? 0 : value;
  return at >= min && at <= max;
};

const countDecimals = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  let exponent = 1;
  let places = 0;
  while (Math.round(value * exponent) / exponent !== value) {
    exponent *= 10;
    places += 1;
  }
  return places;
};

/** `decimalOp`: 0.1 + 0.2 is 0.3, not 0.30000000000000004. */
const decimalOp = (a: number, op: "+" | "-", b: number): number => {
  if (a % 1 === 0 && b % 1 === 0) return op === "+" ? a + b : a - b;
  const multiplier = 10 ** Math.max(countDecimals(a), countDecimals(b));
  const left = Math.round(a * multiplier);
  const right = Math.round(b * multiplier);
  return (op === "+" ? left + right : left - right) / multiplier;
};

const incrementValue = (value: number, step: number): number =>
  decimalOp(Number.isNaN(value) ? 0 : value, "+", step);

const decrementValue = (value: number, step: number): number =>
  decimalOp(Number.isNaN(value) ? 0 : value, "-", step);

const clampValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Number.isNaN(value) ? 0 : value, min), max);

const outOfRange = (ctx: NumberInputContext): boolean =>
  !isValueWithinRange(parseValue(ctx.value), ctx.min, ctx.max);

function moved(
  ctx: NumberInputContext,
  event: NumberInputEvent,
  op: (value: number, step: number) => number,
): Partial<NumberInputContext> {
  const step = "step" in event ? event.step : ctx.step;
  const next = op(parseValue(ctx.value), step);
  const bounded = ctx.allowOverflow ? next : clampValue(next, ctx.min, ctx.max);
  return { value: formatValue(bounded) };
}

const implementations = {
  conds: {
    isIncrementHint: (ctx: NumberInputContext, event: NumberInputEvent): boolean =>
      ("hint" in event ? event.hint : ctx.hint) === "increment",
    isDecrementHint: (ctx: NumberInputContext, event: NumberInputEvent): boolean =>
      ("hint" in event ? event.hint : ctx.hint) === "decrement",
    // The dwell only earns a repeat while the value is in range: a press on
    // an out-of-range value steps once, and clamping decides the rest.
    canRepeat: (ctx: NumberInputContext): boolean => ctx.spinOnPress && !outOfRange(ctx),
    isOutOfRange: outOfRange,
    // Zag's blur guard: `clampValueOnBlur` and a value that is neither empty
    // nor in range. An empty value is never clamped — it stays empty.
    clampsOnBlur: (ctx: NumberInputContext): boolean =>
      ctx.clampValueOnBlur && ctx.value !== "" && outOfRange(ctx),
  },
  assigns: {
    setValue: (ctx: NumberInputContext, event: NumberInputEvent): Partial<NumberInputContext> => {
      if (event.type !== "VALUE.SET") return {};
      const raw = typeof event.value === "number" ? event.value : parseValue(event.value);
      return { value: formatValue(ctx.allowOverflow ? raw : clampValue(raw, ctx.min, ctx.max)) };
    },
    clearValue: (): Partial<NumberInputContext> => ({ value: "" }),
    increment: (ctx: NumberInputContext, event: NumberInputEvent): Partial<NumberInputContext> =>
      moved(ctx, event, incrementValue),
    decrement: (ctx: NumberInputContext, event: NumberInputEvent): Partial<NumberInputContext> =>
      moved(ctx, event, decrementValue),
    setClampedValue: (ctx: NumberInputContext): Partial<NumberInputContext> => ({
      value: formatValue(clampValue(parseValue(ctx.value), ctx.min, ctx.max)),
    }),
    setFormattedValue: (ctx: NumberInputContext): Partial<NumberInputContext> => ({
      value: formatValue(parseValue(ctx.value)),
    }),
    setToMin: (ctx: NumberInputContext): Partial<NumberInputContext> => ({ value: formatValue(ctx.min) }),
    setToMax: (ctx: NumberInputContext): Partial<NumberInputContext> => ({ value: formatValue(ctx.max) }),
    setInputValue: (_ctx: NumberInputContext, event: NumberInputEvent): Partial<NumberInputContext> =>
      event.type === "INPUT.CHANGE" ? { value: event.value } : {},
    beginSpin: (_ctx: NumberInputContext, event: NumberInputEvent): Partial<NumberInputContext> => ({
      hint: event.type === "TRIGGER.PRESS_DOWN" ? event.hint : null,
      spin: "hold",
    }),
    endSpin: (): Partial<NumberInputContext> => ({ hint: null, spin: null }),
    clearHint: (): Partial<NumberInputContext> => ({ hint: null }),
    startRepeat: (): Partial<NumberInputContext> => ({ spin: "repeat" }),
    setCursorPoint: (_ctx: NumberInputContext, event: NumberInputEvent): Partial<NumberInputContext> => {
      const point = "point" in event ? event.point : undefined;
      return point === undefined ? {} : { cursorPoint: point };
    },
    clearCursorPoint: (): Partial<NumberInputContext> => ({ cursorPoint: null }),
    setFieldsetDisabled: (_ctx: NumberInputContext, event: NumberInputEvent): Partial<NumberInputContext> =>
      event.type === "FIELDSET.DISABLED" ? { fieldsetDisabled: event.value } : {},
  },
};

export function numberInput(
  args: NumberInputArgs = {},
  authored: (name: string) => boolean = () => true,
): Machine<NumberInputContext, NumberInputEvent> {
  return createMachine<NumberInputContext, NumberInputEvent>({
    ...config,
    ...implementations,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts: the context fields a host may
     * write, and the event each write carries. A field with an event is
     * REPORTED — the machine decides, and the change reaches the host; a
     * field without one is SILENT.
     */
    fields: {
      value: {},
      min: { parse: (raw) => asNumber(raw, MIN_SAFE) },
      max: { parse: (raw) => asNumber(raw, MAX_SAFE) },
      step: { parse: (raw) => asNumber(raw, DEFAULT_STEP) },
      largeStep: { parse: (raw) => asNumber(raw, 10 * DEFAULT_STEP) },
      smallStep: { parse: (raw) => asNumber(raw, DEFAULT_STEP / 10) },
      allowOverflow: {},
      clampValueOnBlur: {},
      spinOnPress: {},
    },
  });
}
