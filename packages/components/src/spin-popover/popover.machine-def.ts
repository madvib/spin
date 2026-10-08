import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/popover";

/**
 * The popover's Zag wiring. `open-change` is faithful to Zag's
 * `onOpenChange({ open })` — the open boolean, nothing derived.
 */

export interface PopoverOpenChange {
  readonly open: boolean;
}

export const popover: MachineDef = {
  machine,
  connect,
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: { open: boolean }): PopoverOpenChange => ({
        open: change.open,
      }),
    },
  },
};
