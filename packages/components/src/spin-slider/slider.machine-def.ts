import type { MachineDef } from "@spin/runtime";
import { createSliderBridge } from "./slider.bridge.ts";
import type {
  SliderFocusChange,
  SliderValueChange,
  SliderValueChangeEnd,
} from "./slider.machine.ts";

/**
 * The slider's seam: the bridge, the element's imperative commands and the
 * CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries the values
 * on every move, `value-change-end` on release and keyboard commits,
 * `focus-change` the focused thumb.
 */

export type { SliderFocusChange, SliderValueChange, SliderValueChangeEnd };

export const slider: MachineDef = {
  createBridge: createSliderBridge,
  commands: ["setValue", "setThumbValue", "increment", "decrement", "focus"],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: SliderValueChange) => ({ value: [...change.value] }),
    },
    "value-change-end": {
      on: "onValueChangeEnd",
      detail: (change: SliderValueChangeEnd) => ({ value: [...change.value] }),
    },
    "focus-change": {
      on: "onFocusChange",
      detail: (change: SliderFocusChange) => ({
        focusedIndex: change.focusedIndex,
        value: [...change.value],
      }),
    },
  },
};
