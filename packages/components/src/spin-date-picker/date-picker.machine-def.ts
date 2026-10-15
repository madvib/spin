import type { MachineDef } from "@spin/runtime";
import { createDatePickerBridge } from "./date-picker.bridge.ts";
import type { DatePickerValueChange } from "./date-picker.machine.ts";

/**
 * The date-picker's seam: the bridge, the element's imperative commands,
 * and the CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge`
 * routes straight to the fork, which is what makes this interpreter a
 * drop-in behind the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` (the ISO strings), `focus-change` carries
 * `onFocusChange`, `view-change` carries `onViewChange`, and
 * `open-change` carries `onOpenChange`.
 */

export type { DatePickerValueChange };

export const datePicker: MachineDef = {
  createBridge: createDatePickerBridge,
  commands: [
    "open",
    "close",
    "clear",
    "setValue",
  ],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: DatePickerValueChange) => ({
        value: change.value,
        valueAsString: change.valueAsString,
      }),
    },
    "focus-change": {
      on: "onFocusChange",
      detail: (change: { focusedValue: unknown; view: string }) => ({
        focusedValue: change.focusedValue,
        view: change.view,
      }),
    },
    "view-change": {
      on: "onViewChange",
      detail: (change: { view: string }) => ({ view: change.view }),
    },
    "open-change": {
      on: "onOpenChange",
      detail: (change: { open: boolean }) => ({ open: change.open }),
    },
  },
};
