import type { MachineDef } from "@spin/runtime";
import { createSelectBridge } from "./select.bridge.ts";

/**
 * The select machine-def: the seam file codegen finds by consume name.
 *
 * Three modes — closed, closed-and-focused, open — with the selection and
 * the highlight on the root tier so a controlled write lands the same
 * whatever the panel is doing. Every reflex is a stdlib action: dismissable
 * on the content, scroll-into-view on the list, form-control on the hidden
 * select.
 */

export interface SelectOpenChange {
  readonly open: boolean;
  readonly reason: string;
}

export interface SelectValueChange {
  readonly value: string[];
  readonly items: readonly { readonly value: string; readonly label: string }[];
}

export const select: MachineDef = {
  createBridge: createSelectBridge,
  commands: [
    "setOpen",
    "close",
    "toggle",
    "selectValue",
    "setValue",
    "clearValue",
    "focus",
  ],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: SelectValueChange) => ({
        value: change.value,
        items: change.items,
      }),
    },
    "open-change": {
      on: "onOpenChange",
      detail: (change: SelectOpenChange) => ({
        open: change.open,
        reason: change.reason,
      }),
    },
  },
};
