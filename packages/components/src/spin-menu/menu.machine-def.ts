import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/menu";

/**
 * The menu's Zag wiring.
 *
 * The scope declares `open` with no default: any value there is Zag's
 * controlled mode, which pins the menu to that value until a writer moves it,
 * so the trigger could never open it. `defaultOpen` carries the initial state.
 *
 * Both events are faithful to Zag's callbacks: `open-change` carries
 * `onOpenChange({ open })`, `select` carries `onSelect({ value })` — the
 * selected item's value, which the consumer maps back to its own items.
 */

export interface MenuOpenChange {
  readonly open: boolean;
}

export interface MenuSelect {
  readonly value: string;
}

export const menu: MachineDef = {
  machine,
  connect,
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: { open: boolean }): MenuOpenChange => ({
        open: change.open,
      }),
    },
    select: {
      on: "onSelect",
      detail: (change: { value: string }): MenuSelect => ({
        value: change.value,
      }),
    },
  },
};
