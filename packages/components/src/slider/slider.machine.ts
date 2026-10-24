/** Slider machine: idle/focus/dragging over three states. */

import { createMachine, type Machine } from "@spinjs/runtime/fsm";
import type { SliderArgs, SliderContext, SliderState } from "./slider.state.ts";
import { initial } from "./slider.state.ts";
import { isInteractive } from "@spinjs/runtime";
import type { SliderEvents } from "./slider.events.ts";
import {
  clearFocusedIndex,
  decrementThumb,
  hasIndex,
  incrementThumb,
  setAllValues,
  setClosestThumb,
  setEndValue,
  setFocusedIndex,
  setHomeValue,
  setIndexedValue,
  setPointerValue,
} from "./slider.transitions.ts";

export function slider(
  args: SliderArgs = {},
  authored: (name: string) => boolean = () => false,
): Machine<SliderContext, SliderEvents, SliderState> {
  return createMachine<SliderContext, SliderEvents, SliderState>({
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
        { cond: hasIndex, assign: setIndexedValue },
        { assign: setAllValues },
      ],
      INCREMENT: { assign: incrementThumb },
      DECREMENT: { assign: decrementThumb },
    },
    states: {
      idle: {
        on: {
          POINTER_DOWN: {
            target: "dragging",
            assign: [setClosestThumb, setPointerValue],
          },
          FOCUS: {
            target: "focus",
            cond: isInteractive,
            assign: setFocusedIndex,
          },
          THUMB_POINTER_DOWN: {
            target: "dragging",
            assign: setFocusedIndex,
          },
        },
      },
      focus: {
        on: {
          POINTER_DOWN: {
            target: "dragging",
            assign: [setClosestThumb, setPointerValue],
          },
          THUMB_POINTER_DOWN: {
            target: "dragging",
            assign: setFocusedIndex,
          },
          ARROW_DEC: { assign: decrementThumb },
          ARROW_INC: { assign: incrementThumb },
          HOME: { assign: setHomeValue },
          END: { assign: setEndValue },
          BLUR: { target: "idle", assign: clearFocusedIndex },
        },
      },
      dragging: {
        on: {
          POINTER_UP: "focus",
          POINTER_MOVE: { assign: setPointerValue },
          POINTER_CANCEL: {
            target: "idle",
            assign: clearFocusedIndex,
          },
        },
      },
    },
  });
}
