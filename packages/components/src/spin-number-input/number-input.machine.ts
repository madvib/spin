/** Number-input machine: the value, its range, and the spin/scrub gesture. */

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const increment = (ctx: NumberInputContext, event: EventUnion<NumberInputEvents>) : Partial<NumberInputContext> => { return moved(ctx, event, incrementValue); };

const decrement = (ctx: NumberInputContext, event: EventUnion<NumberInputEvents>) : Partial<NumberInputContext> => { return moved(ctx, event, decrementValue); };

const setFormattedValue = (ctx: NumberInputContext) : Partial<NumberInputContext> => { return ({
      value: formatValue(parseValue(ctx.value)),
    }); };

const beginSpin = (_ctx: NumberInputContext, event: EventUnion<NumberInputEvents>) : Partial<NumberInputContext> => { return ({
      hint: event.type === "TRIGGER.PRESS_DOWN" ? event.hint : null,
      spin: "hold",
    }); };

const endSpin = () : Partial<NumberInputContext> => { return ({ hint: null, spin: null }); };

const clearHint = () : Partial<NumberInputContext> => { return ({ hint: null }); };

const setCursorPoint = (_ctx: NumberInputContext, event: EventUnion<NumberInputEvents>) : Partial<NumberInputContext> => {
      const point = "point" in event ? event.point : undefined;
      return point === undefined ? {} : { cursorPoint: point };
    };

const isIncrementHint = (ctx: NumberInputContext, event: EventUnion<NumberInputEvents>) : boolean => { return ("hint" in event ? event.hint : ctx.hint) === "increment"; };

const isDecrementHint = (ctx: NumberInputContext, event: EventUnion<NumberInputEvents>) : boolean => { return ("hint" in event ? event.hint : ctx.hint) === "decrement"; };



const outOfRange = (ctx: NumberInputContext): boolean =>
  !isValueWithinRange(parseValue(ctx.value), ctx.min, ctx.max);
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

export interface NumberInputEvents {
  "VALUE.SET": { value: number | string };
  "VALUE.CLEAR": {};
  "VALUE.INCREMENT": {};
  "VALUE.DECREMENT": {};
  "TRIGGER.PRESS_DOWN": { hint: NumberInputHint };
  "TRIGGER.PRESS_UP": {};
  "CHANGE_DELAY": {};
  "SPIN": {};
  "SCRUBBER.PRESS_DOWN": { point: NumberInputPoint };
  "SCRUBBER.POINTER_MOVE": { hint: NumberInputHint; point: NumberInputPoint };
  "SCRUBBER.POINTER_UP": {};
  "INPUT.FOCUS": {};
  "INPUT.BLUR": {};
  "INPUT.CHANGE": { value: string };
  "INPUT.ARROW_UP": { step: number };
  "INPUT.ARROW_DOWN": { step: number };
  "INPUT.HOME": {};
  "INPUT.END": {};
  "INPUT.ENTER": {};
  "FIELDSET.DISABLED": { value: boolean };
}

export type NumberInputEvent = EventUnion<NumberInputEvents>;


/**
 * The number-input's arguments: the values the host may set.
 *
 * The twin (`defaultValue`) is resolved by the framework before the factory
 * is called, so the machine only ever sees the live value.
 */
export interface NumberInputArgs {
  value?: string;
  /**
   * The twin of `value`. The machine's own gate reads it to tell a
   * declared default from an unwritten channel, so the arguments must
   * carry it: a narrowed bag that drops it loses the seed.
   */
  defaultValue?: string | undefined;
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
 * The controlled bindable writes the prop as the host authored it — no
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
 * A press always leaves `idle`: the `before:spin` state carries the focus
 * tag, so the machine is focused for the whole gesture whether or not the
 * input took DOM focus.
 */
const pressDown = [
  { target: "focused", cond: isDecrementHint, assign: [beginSpin, decrement] },
  { target: "focused", cond: isIncrementHint, assign: [beginSpin, increment] },
];

const scrubDown = { target: "scrubbing", assign: setCursorPoint };

const config: MachineSpec<NumberInputContext, NumberInputEvents> = {
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
    "VALUE.SET": { assign: (ctx, event) => {
      const raw = typeof event.value === "number" ? event.value : parseValue(event.value);
      return { value: formatValue(ctx.allowOverflow ? raw : clampValue(raw, ctx.min, ctx.max)) };
    } },
    "VALUE.CLEAR": { assign: () => { return ({ value: "" }); } },
    "VALUE.INCREMENT": { assign: increment },
    "VALUE.DECREMENT": { assign: decrement },
    "FIELDSET.DISABLED": { assign: (_ctx, event) => { return event.type === "FIELDSET.DISABLED" ? { fieldsetDisabled: event.value } : {}; } },
    // The auto-repeat clock's two ticks, one per phase, valid from wherever
    // the gesture is live.
    "CHANGE_DELAY": [
      { cond: (ctx) => { return ctx.spinOnPress && !outOfRange(ctx); }, assign: () => { return ({ spin: "repeat" }); } },
      // A dwell that cannot earn a repeat ends the gesture: the machine
      // waits for the press-up, with the repeat never armed.
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
        "TRIGGER.PRESS_DOWN": pressDown,
        "SCRUBBER.PRESS_DOWN": scrubDown,
        "INPUT.FOCUS": { target: "focused" },
      },
    },
    focused: {
      on: {
        "TRIGGER.PRESS_DOWN": pressDown,
        "SCRUBBER.PRESS_DOWN": scrubDown,
        "TRIGGER.PRESS_UP": { assign: endSpin },
        // The arrow keys step by the step the view derived from the
        // modifier keys; everything else steps by `step`.
        "INPUT.ARROW_UP": { assign: increment },
        "INPUT.ARROW_DOWN": { assign: decrement },
        "INPUT.HOME": { assign: (ctx) => { return ({ value: formatValue(ctx.min) }); } },
        "INPUT.END": { assign: (ctx) => { return ({ value: formatValue(ctx.max) }); } },
        // A typed value is stored verbatim: the input shows exactly what the
        // host wrote until a blur or Enter reformats it.
        "INPUT.CHANGE": { assign: (_ctx, event) => { return event.type === "INPUT.CHANGE" ? { value: event.value } : {}; } },
        "INPUT.BLUR": [
          {
            target: "idle",
            cond: (ctx) => { return ctx.clampValueOnBlur && ctx.value !== "" && outOfRange(ctx); },
            assign: [(ctx) => { return ({
      value: formatValue(clampValue(parseValue(ctx.value), ctx.min, ctx.max)),
    }); }, clearHint],
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
        "SCRUBBER.POINTER_UP": { target: "focused", assign: () => { return ({ cursorPoint: null }); } },
        "SCRUBBER.POINTER_MOVE": [
          { cond: isIncrementHint, assign: [increment, setCursorPoint] },
          { cond: isDecrementHint, assign: [decrement, setCursorPoint] },
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

const implementations = {};

export function numberInput(
  args: NumberInputArgs = {},
  authored: (name: string) => boolean = () => true,
): Machine<NumberInputContext, NumberInputEvents> {
  return createMachine<NumberInputContext, NumberInputEvents>({
    ...config,
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
