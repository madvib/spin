import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/radio-group";

/**
 * The radio group's Zag wiring. `value-change` is faithful to Zag's
 * `onValueChange({ value })` — the selected item value, nothing derived.
 */

export interface RadioValueChange {
  readonly value: string;
}

export const radioGroup: MachineDef = {
  machine,
  connect,
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: { value: string }): RadioValueChange => ({
        value: change.value,
      }),
    },
  },
};
