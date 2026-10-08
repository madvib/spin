import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/dialog";

/**
 * The dialog's Zag wiring. `open-change` is faithful to Zag's
 * `onOpenChange({ open })` — the open boolean, nothing derived.
 */

export interface DialogOpenChange {
  readonly open: boolean;
}

export const dialog: MachineDef = {
  machine,
  connect,
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: { open: boolean }): DialogOpenChange => ({
        open: change.open,
      }),
    },
  },
};
