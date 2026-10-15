import type { MachineDef } from "@spin/runtime";
import { createListboxBridge } from "./listbox.bridge.ts";
import type {
  ListboxHighlightChange,
  ListboxSelect,
  ListboxValueChange,
} from "./listbox.bridge.ts";

/**
 * The listbox's seam: the bridge, the element's imperative commands and the
 * CustomEvents the host reads.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the new keys and the items they resolve to,
 * `highlight-change` carries `onHighlightChange` with the row it names, and
 * `select` carries `onSelect` with the value the pick landed on.
 */

export type {
  ListboxHighlightChange,
  ListboxSelect,
  ListboxValueChange,
};

export const listbox: MachineDef = {
  createBridge: createListboxBridge,
  commands: [
    "syncSelectedItems",
    "setHighlightValue",
    "clearHighlightValue",
    "selectValue",
    "setValue",
    "selectAll",
    "clearValue",
    "highlightFirst",
    "highlightLast",
    "highlightNext",
    "highlightPrevious",
  ],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: ListboxValueChange) => ({ value: change.value, items: change.items }),
    },
    "highlight-change": {
      on: "onHighlightChange",
      detail: (change: ListboxHighlightChange) => ({
        highlightedValue: change.highlightedValue,
        highlightedItem: change.highlightedItem,
      }),
    },
    select: {
      on: "onSelect",
      detail: (change: ListboxSelect) => ({ value: change.value, itemValue: change.itemValue }),
    },
  },
};
