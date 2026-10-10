import type { MachineDef } from "@spin/runtime";
import { createPinInputFsmBridge } from "./pin-input.bridge.ts";
import type {
  PinInputValueChange,
  PinInputValueComplete,
  PinInputValueInvalid,
} from "./pin-input.bridge.ts";

/**
 * The pin-input's seam: the bridge, the element's imperative commands and
 * the CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge`
 * routes straight to the fork, which is what makes this interpreter a
 * drop-in behind the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the filled cells and their joined string,
 * `value-complete` carries `onValueComplete` (an edge report, fired once
 * when the last empty cell fills), and `value-invalid` carries
 * `onValueInvalid` with the refused keystroke and the focused index.
 */

export type { PinInputValueChange, PinInputValueComplete, PinInputValueInvalid };

export const pinInput: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("pin-input fsm runs through createPinInputFsmBridge");
  }) as never,
  createBridge: createPinInputFsmBridge,
  commands: [
    "focus",
    "setValue",
    "clearValue",
    "setValueAtIndex",
  ],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: PinInputValueChange) => ({
        value: change.value,
        valueAsString: change.valueAsString,
      }),
    },
    "value-complete": {
      on: "onValueComplete",
      detail: (change: PinInputValueComplete) => ({
        value: change.value,
        valueAsString: change.valueAsString,
      }),
    },
    "value-invalid": {
      on: "onValueInvalid",
      detail: (change: PinInputValueInvalid) => ({ value: change.value, index: change.index }),
    },
  },
};
