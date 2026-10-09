import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/switch";

/**
 * The switch's Zag wiring. `checked-change` is faithful to Zag's
 * `onCheckedChange({ checked })`.
 */

export interface SwitchCheckedChange {
  readonly checked: boolean;
}

export const switch_: MachineDef = {
  machine,
  connect,
  events: {
    "checked-change": {
      on: "onCheckedChange",
      detail: (change: { checked: boolean }): SwitchCheckedChange => ({
        checked: change.checked,
      }),
    },
  },
};
