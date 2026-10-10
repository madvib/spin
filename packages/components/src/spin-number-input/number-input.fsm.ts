import type { MachineDef } from "@spin/runtime";
import { createNumberInputFsmBridge } from "./number-input.bridge.ts";
import type {
  NumberInputFocusChange,
  NumberInputInvalidReason,
  NumberInputValueChange,
  NumberInputValueCommit,
  NumberInputValueInvalid,
} from "./number-input.bridge.ts";
/**
 * The number-input's seam: the bridge, the element's imperative commands and
 * the CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the raw value and its number, `value-commit` carries
 * `onValueCommit` on a blur or Enter, `value-invalid` carries `onValueInvalid`
 * with the reason the value left the range, and `focus-change` carries
 * `onFocusChange`.
 */

export type {
  NumberInputFocusChange,
  NumberInputInvalidReason,
  NumberInputValueChange,
  NumberInputValueCommit,
  NumberInputValueInvalid,
};

export const numberInput: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("number-input fsm runs through createNumberInputFsmBridge");
  }) as never,
  createBridge: createNumberInputFsmBridge,
  commands: [
    "setValue",
    "clearValue",
    "increment",
    "decrement",
    "setToMax",
    "setToMin",
    "focus",
  ],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: NumberInputValueChange) => ({ value: change.value, valueAsNumber: change.valueAsNumber }),
    },
    "value-commit": {
      on: "onValueCommit",
      detail: (change: NumberInputValueCommit) => ({ value: change.value, valueAsNumber: change.valueAsNumber }),
    },
    "value-invalid": {
      on: "onValueInvalid",
      detail: (change: NumberInputValueInvalid) => ({
        reason: change.reason,
        value: change.value,
        valueAsNumber: change.valueAsNumber,
      }),
    },
    "focus-change": {
      on: "onFocusChange",
      detail: (change: NumberInputFocusChange) => ({
        focused: change.focused,
        value: change.value,
        valueAsNumber: change.valueAsNumber,
      }),
    },
  },
};
