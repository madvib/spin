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
  machine: machine as unknown as object,
  connect: connect as unknown as (...args: never[]) => object,
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: { value: string }): TabsValueChange => ({
        value: change.value,
      }),
    },
  },
};
