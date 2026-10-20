/**
 * Rating-group machine: idle/focus/hover over Zag's three states.
 *
 * No value math lives in the view: arrows, Home and End resolve against
 * `count` and `allowHalf` here, because the half-step question is a
 * statement about the rating, not about nodes. What the machine never
 * touches is focus itself — `focusActiveRadio` is a view reflex (the
 * connect focuses the checked radio after the machine moves), and the
 * halfway hover flag arrives in the POINTER_OVER event (measured against
 * the item node by the connect).
 *
 * Context stays serializable for the scope channel: the value, the hovered
 * value, and the scalars the assigns read. Guards sit where Zag put them:
 * moves refuse without an interactive pad; SPACE only fills an empty
 * rating; leaving the group returns to focus when a radio holds focus,
 * idle otherwise.
 */

import { assign, defineMachine, guard } from "@spin/runtime";

export interface RatingGroupContext {
  /** The committed rating, -1 for none. Half steps when allowHalf. */
  value: number;
  /** The hovered rating, -1 for none. */
  hoveredValue: number;
  count: number;
  allowHalf: boolean;
  disabled: boolean;
  readOnly: boolean;
}

export type RatingGroupEvent =
  | { type: "SET_VALUE"; value: number }
  | { type: "CLEAR_VALUE" }
  | { type: "GROUP_POINTER_OVER" }
  | { type: "GROUP_POINTER_LEAVE"; radioFocused: boolean }
  | { type: "POINTER_OVER"; index: number; isMidway: boolean }
  | { type: "FOCUS" }
  | { type: "BLUR" }
  | { type: "SPACE"; value: number }
  | { type: "CLICK"; value: number }
  | { type: "ARROW_LEFT" }
  | { type: "ARROW_RIGHT" }
  | { type: "HOME" }
  | { type: "END" }
  | { type: "SET_COUNT"; count: number }
  | { type: "SET_ALLOW_HALF"; allowHalf: boolean }
  | { type: "SET_DISABLED"; disabled: boolean }
  | { type: "SET_READ_ONLY"; readOnly: boolean };

export type RatingGroupValueChange = {
  readonly value: number;
};

export function isInteractive(ctx: RatingGroupContext): boolean {
  return !ctx.disabled && !ctx.readOnly;
}

export function isHovering(ctx: RatingGroupContext): boolean {
  return ctx.hoveredValue > -1;
}

export interface RatingItemState {
  readonly highlighted: boolean;
  readonly half: boolean;
  readonly checked: boolean;
}

/** Zag's getItemState, pure: the hovered value previews while hovering. */
export function itemState(ctx: RatingGroupContext, index: number): RatingItemState {
  const current = isHovering(ctx) ? ctx.hoveredValue : ctx.value;
  const equal = Math.ceil(current) === index;
  return {
    highlighted: index <= current || equal,
    half: equal && Math.abs(current - index) === 0.5,
    checked: equal || (ctx.value <= 0 && index === 1),
  };
}

const step = (ctx: RatingGroupContext): number => (ctx.allowHalf ? 0.5 : 1);

/** The rating-group machine: state and nothing else. It never sees a
 * prop — the consumer sends it events, and it answers with state. */
export const ratingGroupMachine = defineMachine<RatingGroupContext, RatingGroupEvent>({
  id: "rating-group",
  initial: "idle",
  context: {
    value: -1,
    hoveredValue: -1,
    count: 5,
    allowHalf: false,
    disabled: false,
    readOnly: false,
  },
  on: {
    SET_VALUE: { actions: [{ assign: "setValueTo" }] },
    CLEAR_VALUE: { actions: [{ assign: "clearValue" }] },
    SET_COUNT: { actions: [{ assign: "setCount" }] },
    SET_ALLOW_HALF: { actions: [{ assign: "setAllowHalf" }] },
    SET_DISABLED: { actions: [{ assign: "setDisabled" }] },
    SET_READ_ONLY: { actions: [{ assign: "setReadOnly" }] },
  },
  states: {
    idle: {
      entry: [{ assign: "clearHoveredValue" }],
      on: {
        GROUP_POINTER_OVER: { target: "hover" },
        FOCUS: { target: "focus" },
        CLICK: { actions: [{ assign: "setValue" }] },
      },
    },
    focus: {
      on: {
        POINTER_OVER: { actions: [{ assign: "setHoveredValue" }] },
        GROUP_POINTER_LEAVE: { actions: [{ assign: "clearHoveredValue" }] },
        BLUR: { target: "idle" },
        SPACE: [{ cond: "isValueEmpty", actions: [{ assign: "setValue" }] }],
        CLICK: { actions: [{ assign: "setValue" }] },
        ARROW_LEFT: { actions: [{ assign: "setPrevValue" }] },
        ARROW_RIGHT: { actions: [{ assign: "setNextValue" }] },
        HOME: { actions: [{ assign: "setValueToMin" }] },
        END: { actions: [{ assign: "setValueToMax" }] },
      },
    },
    hover: {
      on: {
        POINTER_OVER: { actions: [{ assign: "setHoveredValue" }] },
        // A focus is a focus, whatever the pointer is doing: the keyboard
        // lives in the focus state.
        FOCUS: { target: "focus" },
        GROUP_POINTER_LEAVE: [
          { cond: "radioFocused", target: "focus", actions: [{ assign: "clearHoveredValue" }] },
          { target: "idle", actions: [{ assign: "clearHoveredValue" }] },
        ],
        CLICK: { actions: [{ assign: "setValue" }] },
      },
    },
  },
  assigns: {
    setValueTo: assign("SET_VALUE", (_ctx, event) => ({ value: event.value })),
    clearValue: assign("CLEAR_VALUE", () => ({ value: -1 })),
    setCount: assign("SET_COUNT", (_ctx, event) => ({ count: Math.max(1, Math.floor(event.count)) })),
    setAllowHalf: assign("SET_ALLOW_HALF", (_ctx, event) => ({ allowHalf: event.allowHalf })),
    setDisabled: assign("SET_DISABLED", (_ctx, event) => ({ disabled: event.disabled })),
    setReadOnly: assign("SET_READ_ONLY", (_ctx, event) => ({ readOnly: event.readOnly })),
    clearHoveredValue: assign(() => ({ hoveredValue: -1 })),
    // CLICK and SPACE carry the item's own value; a live hover preview wins,
    // exactly as Zag's setValue prefers the hovered value.
    setValue: assign("CLICK", (ctx, event) => ({
      value: ctx.hoveredValue === -1 ? event.value : ctx.hoveredValue,
    })),
    setHoveredValue: assign("POINTER_OVER", (ctx, event) => ({
      hoveredValue: event.index - (ctx.allowHalf && event.isMidway ? 0.5 : 0),
    })),
    setPrevValue: assign((ctx) => ({ value: Math.max(0, ctx.value - step(ctx)) })),
    setNextValue: assign((ctx) => ({
      value: Math.min(ctx.count, (ctx.value === -1 ? 0 : ctx.value) + step(ctx)),
    })),
    setValueToMin: assign(() => ({ value: 1 })),
    setValueToMax: assign((ctx) => ({ value: ctx.count })),
  },
  conds: {
    isValueEmpty: guard("CLICK", (ctx) => ctx.value <= 0),
    radioFocused: guard("GROUP_POINTER_LEAVE", (_ctx, event) => event.radioFocused),
  },
});
