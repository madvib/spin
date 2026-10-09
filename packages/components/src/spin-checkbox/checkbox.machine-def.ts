import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/checkbox";

/**
 * The checkbox's Zag wiring. `checked-change` is faithful to Zag's
 * `onCheckedChange({ checked })` — true, false, or "indeterminate".
 */

export interface CheckboxCheckedChange {
  readonly checked: boolean | "indeterminate";
}

export const checkbox: MachineDef = {
  machine,
  connect,
  events: {
    "checked-change": {
      on: "onCheckedChange",
      detail: (change: { checked: boolean | "indeterminate" }): CheckboxCheckedChange => ({
        checked: change.checked,
      }),
    },
  },
};
