import type { MachineDef } from "@spin/runtime";
import { createSliderFsmBridge } from "./slider.bridge.ts";
import type { SliderFocusChange, SliderValueChange } from "./slider.machine.ts";

/**
 * The slider's seam: the machine-def codegen finds by consume name.
 *
 * `machine`/`connect` are inert placeholders — the bridge path bypasses the
 * Zag adapter entirely, which is what makes this interpreter a drop-in
 * behind the same `<name>.machine-def.ts` contract. `commands` are the
 * declared imperative surface (`el.setValue`, `el.focus`); `events` is the
 * authored out-side, faithful to Zag's callback payloads.
 */

export const slider: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("slider fsm runs through createSliderFsmBridge");
  }) as never,
  createBridge: createSliderFsmBridge,
  commands: ["setValue", "focus"],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: SliderValueChange): SliderValueChange => ({ value: change.value }),
    },
    "value-change-end": {
      on: "onValueChangeEnd",
      detail: (change: SliderValueChange): SliderValueChange => ({ value: change.value }),
    },
    "focus-change": {
      on: "onFocusChange",
      detail: (change: SliderFocusChange): SliderFocusChange => ({
        focusedIndex: change.focusedIndex,
        value: change.value,
      }),
    },
  },
};
