import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/tooltip";

/**
 * The tooltip's Zag wiring. `open-change` is faithful to Zag's
 * `onOpenChange({ open })` — the open boolean, nothing derived.
 */

export interface TooltipOpenChange {
  readonly open: boolean;
}

export const tooltip: MachineDef = {
  machine: machine as unknown as object,
  connect: connect as unknown as (...args: never[]) => object,
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: { open: boolean }): TooltipOpenChange => ({
        open: change.open,
      }),
    },
  },
};
