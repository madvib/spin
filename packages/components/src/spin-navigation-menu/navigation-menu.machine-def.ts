import type { MachineDef } from "@spin/runtime";
import { createNavigationMenuBridge } from "./navigation-menu.bridge.ts";
import type { NavigationMenuValueChange } from "./navigation-menu.machine.ts";

/**
 * The navigation-menu's seam: the bridge, the element's imperative
 * commands, and the CustomEvents the host reads.
 *
 * `value-change` carries `onValueChange` with the open item and the one
 * it came from — the pair drives the viewport slide for hosts that
 * build one.
 */

export type { NavigationMenuValueChange };

export const navigationMenu: MachineDef = {
  createBridge: createNavigationMenuBridge,
  commands: ["show", "hide", "toggle"],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: NavigationMenuValueChange) => ({
        value: change.value,
        previousValue: change.previousValue,
      }),
    },
  },
};
