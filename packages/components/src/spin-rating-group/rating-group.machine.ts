import { createMachine, type Machine } from "@spin/runtime/fsm";
import type { RatingGroupArgs, RatingGroupContext, RatingGroupState } from "./rating-group.state.ts";
import { initial } from "./rating-group.state.ts";
import type { RatingGroupEvents } from "./rating-group.events.ts";
import {
  applyCount,
  applyValue,
  arrowLeft,
  arrowRight,
  clearHoveredValue,
  clearValue,
  endValue,
  homeValue,
  setHoveredValue,
  setValue,
} from "./rating-group.transitions.ts";

export {
  isHovering,
  isInteractive,
  itemState,
  ratingValue,
  step,
} from "./rating-group.state.ts";

export type { RatingGroupArgs, RatingGroupContext, RatingGroupState } from "./rating-group.state.ts";
export type { RatingGroupEvents, RatingGroupValueChange, RatingGroupHoverChange } from "./rating-group.events.ts";

export function ratingGroup(
  args: RatingGroupArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<RatingGroupContext, RatingGroupEvents, RatingGroupState> {
  return createMachine<RatingGroupContext, RatingGroupEvents, RatingGroupState>({
    id: "rating-group",
    initial: "idle",
    fields: {
      value: { event: "SET_VALUE" },
      count: { event: "SET_COUNT" },
      allowHalf: {},
      disabled: {},
      readOnly: {},
      required: {},
      name: {},
      label: {},
    },
    context: initial(args, authored),
    on: {
      SET_VALUE: { assign: applyValue },
      CLEAR_VALUE: { assign: clearValue },
      SET_COUNT: { assign: applyCount },
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
          SPACE: [{ cond: (ctx) => ctx.value <= 0, assign: setValue }],
          CLICK: { assign: setValue },
          ARROW_LEFT: { assign: arrowLeft },
          ARROW_RIGHT: { assign: arrowRight },
          HOME: { assign: homeValue },
          END: { assign: endValue },
        },
      },
      hover: {
        on: {
          POINTER_OVER: { assign: setHoveredValue },
          FOCUS: { target: "focus" },
          GROUP_POINTER_LEAVE: [
            {
              cond: (_ctx, event) => {
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
    },
  });
}