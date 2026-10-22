/** Slider machine: idle/focus/dragging over three states. */

import { createMachine, type Machine } from "@spin/runtime/fsm";
import type { SliderArgs, SliderContext } from "./slider.state.ts";
import { initial } from "./slider.state.ts";
import { isInteractive } from "@spin/runtime";
import type { SliderEvents } from "./slider.events.ts";
import {
  clearDragRefs,
  clearFocusedIndex,
  decrementThumb,
  hasIndex,
  incrementThumb,
  setAllValues,
  setClosestThumb,
  setDisabled,
  setDragOffset,
  setEndValue,
  setFocusedIndex,
  setHomeValue,
  setIndexedValue,
  setMax,
  setMin,
  setPointerValue,
  setReadOnly,
  setStep,
  snapshotDragStart,
} from "./slider.transitions.ts";
export function slider(
  args: SliderArgs = {},
  // A script-constructed machine has no host-authored props; the authored
  // channel exists only for element property/attribute writes.
  authored: (name: string) => boolean = () => false,
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
        { cond: hasIndex, assign: setIndexedValue },
        { assign: setAllValues },
      ],
      INCREMENT: { assign: incrementThumb },
      DECREMENT: { assign: decrementThumb },
      SET_MIN: { assign: setMin },
      SET_MAX: { assign: setMax },
      SET_STEP: { assign: setStep },
      SET_DISABLED: { assign: setDisabled },
      SET_READ_ONLY: { assign: setReadOnly },
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
            cond: isInteractive,
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
          HOME: { assign: setHomeValue },
          END: { assign: setEndValue },
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
