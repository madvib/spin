/**
 * Rating-group machine: idle/focus/hover over three states.
 *
 * The machine never touches focus: the view focuses the checked radio after
 * a move, and the halfway hover flag arrives measured in POINTER_OVER.
 */

import { createMachine, type Machine, type EventUnion } from "@spin/runtime/fsm";
const clearHoveredValue = () : Partial<RatingGroupContext> => { return ({
        hoveredValue: -1,
      }); };

const setValue = (ctx: RatingGroupContext, event: EventUnion<RatingGroupEvents>) : Partial<RatingGroupContext> => {
        if (event.type !== "CLICK" && event.type !== "SPACE") return {};
        return {
          value: ctx.hoveredValue === -1 ? event.value : ctx.hoveredValue,
        };
      };

const setHoveredValue = (ctx: RatingGroupContext, event: EventUnion<RatingGroupEvents>) : Partial<RatingGroupContext> => {
        if (event.type !== "POINTER_OVER") return {};
        return {
          hoveredValue: event.index -
            (ctx.allowHalf && event.isMidway ? 0.5 : 0),
        };
      };



const ratingValue = (raw: unknown): number => {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : -1;
};

export interface RatingGroupContext {
  value: number;
  hoveredValue: number;
  count: number;
  allowHalf: boolean;
  disabled: boolean;
  readOnly: boolean;
}

export interface RatingGroupEvents {
  "SET_VALUE": { value: number };
  "CLEAR_VALUE": {};
  "GROUP_POINTER_OVER": {};
  "GROUP_POINTER_LEAVE": { radioFocused: boolean };
  "POINTER_OVER": { index: number; isMidway: boolean };
  "FOCUS": {};
  "BLUR": {};
  "SPACE": { value: number };
  "CLICK": { value: number };
  "ARROW_LEFT": {};
  "ARROW_RIGHT": {};
  "HOME": {};
  "END": {};
  "SET_COUNT": { count: number };
  "SET_ALLOW_HALF": { allowHalf: boolean };
  "SET_DISABLED": { disabled: boolean };
  "SET_READ_ONLY": { readOnly: boolean };
}

export type RatingGroupEvent = EventUnion<RatingGroupEvents>;


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

export function itemState(
  ctx: RatingGroupContext,
  index: number,
): RatingItemState {
  const current = isHovering(ctx) ? ctx.hoveredValue : ctx.value;
  const equal = Math.ceil(current) === index;
  return {
    highlighted: index <= current || equal,
    half: equal && Math.abs(current - index) === 0.5,
    checked: equal || (ctx.value <= 0 && index === 1),
  };
}

const step = (ctx: RatingGroupContext): number => (ctx.allowHalf ? 0.5 : 1);

/**
 * The rating-group's arguments: the values the host may set.
 */
export interface RatingGroupArgs {
  value?: string;
  count?: number;
  allowHalf?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  defaultReadOnly?: boolean;
}

export function ratingGroup(
  args: RatingGroupArgs = {},
  authored: (name: string) => boolean,
): Machine<RatingGroupContext, RatingGroupEvents> {
  return createMachine<RatingGroupContext, RatingGroupEvents>({
    id: "rating-group",
    initial: "idle",
    fields: {
      value: { event: "SET_VALUE" },
      count: { event: "SET_COUNT" },
      allowHalf: {},
      disabled: {},
      readOnly: {},
    },
    context: {
      value: ratingValue(args.value),
      hoveredValue: -1,
      count: args.count ?? 5,
      allowHalf: args.allowHalf === true,
      disabled: args.disabled === true,
      readOnly: args.readOnly === true,
    },
    on: {
      SET_VALUE: { assign: (ctx, event) => {
        return { value: ratingValue(event.value) };
      } },
      CLEAR_VALUE: { assign: () => { return ({ value: -1 }); } },
      SET_COUNT: { assign: (ctx, event) => {
        return { count: Math.max(1, Math.floor(event.count)) };
      } },
      SET_ALLOW_HALF: { assign: (ctx, event) => {
        return { allowHalf: event.allowHalf };
      } },
      SET_DISABLED: { assign: (ctx, event) => {
        return { disabled: event.disabled };
      } },
      SET_READ_ONLY: { assign: (ctx, event) => {
        return { readOnly: event.readOnly };
      } },
    },
    states: {
      idle: {
        entry: [{ assign: clearHoveredValue }],
        on: {
          GROUP_POINTER_OVER: { target: "hover" },
          FOCUS: { target: "focus" },
          CLICK: { assign: setValue },
        },
      },
      focus: {
        on: {
          POINTER_OVER: { assign: setHoveredValue },
          GROUP_POINTER_LEAVE: { assign: clearHoveredValue },
          BLUR: { target: "idle" },
          SPACE: [{ cond: (ctx) => { return ctx.value <= 0; }, assign: setValue }],
          CLICK: { assign: setValue },
          ARROW_LEFT: { assign: (ctx) => { return ({
        value: Math.max(0, ctx.value - step(ctx)),
      }); } },
          ARROW_RIGHT: { assign: (ctx) => { return ({
        value: Math.min(
          ctx.count,
          (ctx.value === -1 ? 0 : ctx.value) + step(ctx),
        ),
      }); } },
          HOME: { assign: () => { return ({ value: 1 }); } },
          END: { assign: (ctx) => { return ({ value: ctx.count }); } },
        },
      },
      hover: {
        on: {
          POINTER_OVER: { assign: setHoveredValue },
          // A focus is a focus: the keyboard lives in the focus state.
          FOCUS: { target: "focus" },
          GROUP_POINTER_LEAVE: [
            {
              cond: (ctx, event) => {
        if (event.type !== "GROUP_POINTER_LEAVE") return false;
        return event.radioFocused;
      },
              target: "focus",
              assign: clearHoveredValue,
            },
            { target: "idle", assign: clearHoveredValue },
          ],
          CLICK: { assign: setValue },
        },
      },
    },});
}
