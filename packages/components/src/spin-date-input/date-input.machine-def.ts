import type { MachineDef } from "@spin/runtime";
import { createDateInputBridge } from "./date-input.bridge.ts";
import type { DateInputValueChange, DateValue } from "./date-input.bridge.ts";

/**
 * The date-input's seam: the bridge, the element's imperative commands and
 * the CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge`
 * routes straight to the fork, which is what makes this interpreter a
 * drop-in behind the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the committed ISO date and its `yyyy-mm-dd` string.
 */

export type { DateInputValueChange, DateValue };

export const dateInput: MachineDef = {
  createBridge: createDateInputBridge,
  commands: [
    "focus",
    "setValue",
    "clearValue",
  ],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: DateInputValueChange) => ({
        value: change.value,
        valueAsString: change.valueAsString,
      }),
    },
  },
};
