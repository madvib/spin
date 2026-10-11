import type { MachineDef } from "@spin/runtime";
import { createCascadeBridge } from "./cascade.bridge.ts";
import type { CascadeHighlightChange, CascadeOpenChange, CascadeValueChange } from "./cascade.bridge.ts";

/**
 * The cascade-select's seam: the bridge, the element's imperative commands and
 * the CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `open-change` carries `onOpenChange`
 * (with the value, as select does), `value-change` carries `onValueChange`
 * with the paths and the item chains along them, `highlight-change` carries
 * `onHighlightChange`, and the three outside callbacks the dismissable reflex
 * reports (`pointer-down-outside`, `focus-outside`, `interact-outside`) map to
 * `onPointerDownOutside`, `onFocusOutside` and `onInteractOutside`.
 */

export type { CascadeHighlightChange, CascadeOpenChange, CascadeValueChange };

export const cascade: MachineDef = {
  createBridge: createCascadeBridge,
  commands: [
    "focus",
    "setOpen",
    "setHighlightValue",
    "clearHighlightValue",
    "setValue",
    "selectValue",
    "clearValue",
  ],
  events: {
    "open-change": {
      on: "onOpenChange",
      detail: (change: CascadeOpenChange) => ({ open: change.open, value: change.value }),
    },
    "value-change": {
      on: "onValueChange",
      detail: (change: CascadeValueChange) => ({ value: change.value, items: change.items }),
    },
    "highlight-change": {
      on: "onHighlightChange",
      detail: (change: CascadeHighlightChange) => ({
        highlightedValue: change.highlightedValue,
        highlightedItems: change.highlightedItems,
      }),
    },
    "pointer-down-outside": {
      on: "onPointerDownOutside",
      detail: (event: PointerEvent) => ({ originalEvent: event }),
    },
    "focus-outside": {
      on: "onFocusOutside",
      detail: (event: FocusEvent) => ({ originalEvent: event }),
    },
    "interact-outside": {
      on: "onInteractOutside",
      detail: (change: { focusable: boolean; contextmenu: boolean; originalEvent: PointerEvent | FocusEvent }) => change,
    },
  },
};
