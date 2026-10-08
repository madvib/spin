import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/tabs";

/**
 * The tabs' Zag wiring. `value-change` is faithful to Zag's
 * `onValueChange({ value })` — the selected tab value, nothing derived.
 */

export interface TabsValueChange {
  readonly value: string;
}

export const tabs: MachineDef = {
  machine,
  connect,
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: { value: string }): TabsValueChange => ({
        value: change.value,
      }),
    },
  },
};
