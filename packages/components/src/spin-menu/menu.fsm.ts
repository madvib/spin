import type { MachineDef } from "@spin/runtime";
import { createMenuFsmBridge } from "./menu.bridge.ts";
import type { MenuHighlightChange, MenuOpenChange, MenuSelect } from "./menu.bridge.ts";

/**
 * The menu's seam: the bridge, the element's imperative commands and the
 * CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `open-change` carries `onOpenChange`,
 * `select` carries `onSelect` with the clicked item's value, and
 * `highlight-change` carries `onHighlightChange`, which Zag's bindable
 * highlightedValue fires whenever the highlighted item moves.
 */

export type { MenuHighlightChange, MenuOpenChange, MenuSelect };

export const menu: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("menu fsm runs through createMenuFsmBridge");
  }) as never,
  createBridge: createMenuFsmBridge,
  commands: ["open", "close", "setHighlighted"],
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: MenuOpenChange) => ({ open: change.open }),
    },
    select: {
      on: "onSelect",
      detail: (change: MenuSelect) => ({ value: change.value }),
    },
    "highlight-change": {
      on: "onHighlightChange",
      detail: (change: MenuHighlightChange) => ({ highlightedValue: change.highlightedValue }),
    },
  },
};
