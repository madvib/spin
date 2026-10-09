import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/slider";

/**
 * The slider's Zag wiring.
 *
 * `value-change` is faithful to Zag's `onValueChange({ value })` — the
 * current value array, which for a single-value slider is `[value]`.
 * `value-change-end` carries `onValueChangeEnd({ value })` — fired when
 * the user releases the thumb or finishes keyboard interaction.
 */

export interface SliderValueChange {
  readonly value: readonly number[];
}

export interface SliderValueChangeEnd {
  readonly value: readonly number[];
}

export const slider: MachineDef = {
  machine,
  connect,
  toMachineProps: (values) => ({
    // Zag reads defaultValue as number[]; scope declares a scalar int.
    defaultValue: [values.defaultValue as number],
  }),
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: { value: number[] }): SliderValueChange => ({
        value: change.value,
      }),
    },
    "value-change-end": {
      on: "onValueChangeEnd",
      detail: (change: { value: number[] }): SliderValueChangeEnd => ({
        value: change.value,
      }),
    },
  },
};
