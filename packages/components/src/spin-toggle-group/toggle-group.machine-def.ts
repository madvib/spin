import type { MachineDef } from "@spin/runtime";
import { createToggleGroupBridge } from "./toggle-group.bridge.ts";
import type { ToggleGroupValueChange } from "./toggle-group.machine.ts";

/**
 * The toggle-group's seam: the bridge, the element's imperative commands
 * and the CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries the
 * selection on every toggle.
 */

export type { ToggleGroupValueChange };

export const toggleGroup: MachineDef = {
  createBridge: createToggleGroupBridge,
  commands: ["setValue"],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: ToggleGroupValueChange) => ({ value: [...change.value] }),
    },
  },
};
