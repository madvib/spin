/**
 * Number-input machine: the value, its range, and the gesture the spin
 * controls and the scrubber share.
 *
 * Zag's chart is `idle` plus four states, of which two (`before:spin`,
 * `spinning`) exist only to time the press-and-hold repeat. In this
 * architecture a timer is a reflex, so the chart keeps the three states that
 * carry meaning — the input holds DOM focus or it does not, and the scrubber
 * gesture is live or it is not — while the dwell and the repeat rate live in
 * the bridge's clock. What survives in the context is the phase the gesture
 * is in (`spin`), which is the one fact the machine transitions on: the
 * repeat starts when the phase moves from `hold` to `repeat`, and it stops
 * when the phase clears.
 *
 * Everything here is a pure transform of the scalars the bridge syncs from
 * scope. The view never sends a DOM node: `INPUT.CHANGE` carries the raw
 * string the input holds, and clamping/formatting happens here, exactly as
 * Zag's `setRawValue` does.
 */

/** The direction a spin control or a scrub drag is pushing the value. */
export type NumberInputHint = "increment" | "decrement";

/** A viewport point, in client coordinates. */
export interface NumberInputPoint {
  readonly x: number;
  readonly y: number;
}

export interface NumberInputContext {
  /** The raw string the input holds; formatted only on a commit. */
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
 * A press always leaves `idle`: Zag's `before:spin` carries the focus tag, so
 * the machine is focused for the whole gesture whether or not the input took
 * DOM focus (`focusInputOnChange` decides that, and it is the view's call).
 */
const pressDown = [
  { target: "focused", cond: "isDecrementHint", actions: [{ assign: "beginSpin" }, { assign: "decrement" }] },
  { target: "focused", cond: "isIncrementHint", actions: [{ assign: "beginSpin" }, { assign: "increment" }] },
];

const scrubDown = { target: "scrubbing", actions: [{ assign: "setCursorPoint" }] };

export const config = {
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
  // The root tier: the value events are valid in every state, which is how
  // Zag expresses "setValue works whether or not the input holds focus".
  on: {
    "VALUE.SET": { actions: [{ assign: "setValue" }] },
    "VALUE.CLEAR": { actions: [{ assign: "clearValue" }] },
    "VALUE.INCREMENT": { actions: [{ assign: "increment" }] },
    "VALUE.DECREMENT": { actions: [{ assign: "decrement" }] },
    "FIELDSET.DISABLED": { actions: [{ assign: "setFieldsetDisabled" }] },
    // The auto-repeat clock's two ticks, one per phase. Both are valid from
    // wherever the gesture is live, so they sit in the fallback tier rather
    // than being duplicated across states.
    "CHANGE_DELAY": [
      { cond: "canRepeat", actions: [{ assign: "startRepeat" }] },
      // A dwell that cannot earn a repeat ends the gesture: Zag leaves the
      // machine waiting for the press-up, which is the same observable
      // outcome with the repeat never armed.
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
        // The arrow keys step by the step the view derived from the modifier
        // keys; everything else steps by `step`.
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

// ---------------------------------------------------------------------------
// The arithmetic — Zag's number helpers, kept local so the port has no
// dependency on the packages it replaces.
// ---------------------------------------------------------------------------

/**
 * `parseValue` with no format options: the platform's own parse. `Infinity`
 * is finite-checked away, so `parseValue("nope")` is NaN.
 */
export const parseValue = (raw: string): number => Number.parseFloat(raw);

/** `formatValue`: the absent value is the empty string. */
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

/** The whole value pipeline: parse, move, clamp, format. */
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

export const implementations = {
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
