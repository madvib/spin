import type { MachineDef } from "@spin/runtime";
import { createAngleSliderBridge } from "./angle-slider.bridge.ts";
import type { AngleSliderValueChangeEnd } from "./angle-slider.bridge.ts";
import type { AngleSliderValueChange } from "./angle-slider.machine.ts";

/**
 * The angle-slider's seam: the bridge, the element's imperative commands
 * and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries the
 * degrees on every move, `value-change-end` on release and keyboard
 * commits.
 */

export type { AngleSliderValueChange, AngleSliderValueChangeEnd };

export const angleSlider: MachineDef = {
  createBridge: createAngleSliderBridge,
  commands: ["setValue", "focus"],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: AngleSliderValueChange) => ({
        value: change.value,
        valueAsDegree: change.valueAsDegree,
      }),
    },
    "value-change-end": {
      on: "onValueChangeEnd",
      detail: (change: AngleSliderValueChangeEnd) => ({
        value: change.value,
        valueAsDegree: change.valueAsDegree,
      }),
    },
  },
};
