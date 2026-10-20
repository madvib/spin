/**
 * Rating-group machine: idle/focus/hover over Zag's three states.
 *
 * The machine never touches focus: the view focuses the checked radio after
 * a move, and the halfway hover flag arrives measured in POINTER_OVER.
 */

import { createMachine, type Machine } from "@spin/runtime/fsm";

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
): Machine<RatingGroupContext, RatingGroupEvent> {
  return createMachine<RatingGroupContext, RatingGroupEvent>({
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
          // A focus is a focus: the keyboard lives in the focus state.
          FOCUS: { target: "focus" },
          GROUP_POINTER_LEAVE: [
            {
              cond: "radioFocused",
              target: "focus",
              actions: [{ assign: "clearHoveredValue" }],
            },
            { target: "idle", actions: [{ assign: "clearHoveredValue" }] },
          ],
          CLICK: { actions: [{ assign: "setValue" }] },
        },
      },
    },
    assigns: {
      setValueTo: (
        ctx: RatingGroupContext,
        event: RatingGroupEvent,
      ): Partial<RatingGroupContext> => {
        if (event.type !== "SET_VALUE") return {};
        return { value: ratingValue(event.value) };
      },
      clearValue: (): Partial<RatingGroupContext> => ({ value: -1 }),
      setCount: (
        ctx: RatingGroupContext,
        event: RatingGroupEvent,
      ): Partial<RatingGroupContext> => {
        if (event.type !== "SET_COUNT") return {};
        return { count: Math.max(1, Math.floor(event.count)) };
      },
      setAllowHalf: (
        ctx: RatingGroupContext,
        event: RatingGroupEvent,
      ): Partial<RatingGroupContext> => {
        if (event.type !== "SET_ALLOW_HALF") return {};
        return { allowHalf: event.allowHalf };
      },
      setDisabled: (
        ctx: RatingGroupContext,
        event: RatingGroupEvent,
      ): Partial<RatingGroupContext> => {
        if (event.type !== "SET_DISABLED") return {};
        return { disabled: event.disabled };
      },
      setReadOnly: (
        ctx: RatingGroupContext,
        event: RatingGroupEvent,
      ): Partial<RatingGroupContext> => {
        if (event.type !== "SET_READ_ONLY") return {};
        return { readOnly: event.readOnly };
      },
      clearHoveredValue: (): Partial<RatingGroupContext> => ({
        hoveredValue: -1,
      }),
      // A live hover preview wins over the item's own value, as in Zag.
      setValue: (
        ctx: RatingGroupContext,
        event: RatingGroupEvent,
      ): Partial<RatingGroupContext> => {
        if (event.type !== "CLICK" && event.type !== "SPACE") return {};
        return {
          value: ctx.hoveredValue === -1 ? event.value : ctx.hoveredValue,
        };
      },
      setHoveredValue: (
        ctx: RatingGroupContext,
        event: RatingGroupEvent,
      ): Partial<RatingGroupContext> => {
        if (event.type !== "POINTER_OVER") return {};
        return {
          hoveredValue: event.index -
            (ctx.allowHalf && event.isMidway ? 0.5 : 0),
        };
      },
      setPrevValue: (ctx: RatingGroupContext): Partial<RatingGroupContext> => ({
        value: Math.max(0, ctx.value - step(ctx)),
      }),
      setNextValue: (ctx: RatingGroupContext): Partial<RatingGroupContext> => ({
        value: Math.min(
          ctx.count,
          (ctx.value === -1 ? 0 : ctx.value) + step(ctx),
        ),
      }),
      setValueToMin: (): Partial<RatingGroupContext> => ({ value: 1 }),
      setValueToMax: (
        ctx: RatingGroupContext,
      ): Partial<RatingGroupContext> => ({ value: ctx.count }),
    },
    conds: {
      isValueEmpty: (ctx: RatingGroupContext): boolean => ctx.value <= 0,
      radioFocused: (
        ctx: RatingGroupContext,
        event: RatingGroupEvent,
      ): boolean => {
        if (event.type !== "GROUP_POINTER_LEAVE") return false;
        return event.radioFocused;
      },
    },
  });
}
