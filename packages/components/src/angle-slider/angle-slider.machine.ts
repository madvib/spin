import { createMachine, type Machine } from "@spin/runtime/fsm";
import type { AngleSliderArgs, AngleSliderContext, AngleSliderState } from "./angle-slider.state.ts";
import { initial } from "./angle-slider.state.ts";
import type { AngleSliderEvents } from "./angle-slider.events.ts";
import {
  arrowDec,
  arrowInc,
  setDragOffset,
  setPointerValue,
  setValue,
} from "./angle-slider.transitions.ts";
import { isInteractive } from "./angle-slider.state.ts";

export const MIN_VALUE = 0;
export const MAX_VALUE = 359;

export function angleSlider(
  args: AngleSliderArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<AngleSliderContext, AngleSliderEvents, AngleSliderState> {
  return createMachine<AngleSliderContext, AngleSliderEvents, AngleSliderState>({
    id: "angle-slider",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      value: { event: "VALUE.SET" },
      step: {},
      largeStep: {},
      dir: {},
      disabled: {},
      readOnly: {},
      invalid: {},
      name: {},
      ariaLabel: {},
    },
    on: {
      "VALUE.SET": { assign: setValue },
    },
    states: {
      idle: {
        on: {
          "CONTROL.POINTER_DOWN": {
            target: "dragging",
            assign: [setDragOffset, setPointerValue],
          },
          "THUMB.FOCUS": { target: "focused" },
        },
      },
      focused: {
        on: {
          "CONTROL.POINTER_DOWN": {
            target: "dragging",
            assign: [setDragOffset, setPointerValue],
          },
          "THUMB.ARROW_DEC": { assign: arrowDec },
          "THUMB.ARROW_INC": { assign: arrowInc },
          "THUMB.HOME": { assign: () => ({ value: MIN_VALUE }) },
          "THUMB.END": { assign: () => ({ value: MAX_VALUE }) },
          "THUMB.BLUR": { target: "idle" },
        },
      },
      dragging: {
        on: {
          "DOC.POINTER_UP": { target: "focused", assign: () => ({ dragOffset: null }) },
          "DOC.POINTER_MOVE": { assign: setPointerValue },
        },
      },
    },
  });
}

// Re-export helpers for tests/import compatibility
export * from "./angle-slider.state.ts";
export type { AngleSliderValueChange } from "./angle-slider.events.ts";
export { defaultTwin } from "@spin/runtime";
