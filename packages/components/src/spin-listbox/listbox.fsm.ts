import type { MachineDef } from "@spin/runtime";
import { createListboxFsmBridge } from "./listbox.bridge.ts";
import type {
  ListboxHighlightChange,
  ListboxSelect,
  ListboxValueChange,
} from "./listbox.bridge.ts";
/**
 * The listbox's seam: the bridge, the element's imperative commands and the
 * CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the new keys and the items they resolve to,
 * `highlight-change` carries `onHighlightChange`, and `select` carries
 * `onSelect` with each value the move added.
 */

export type { ListboxHighlightChange, ListboxSelect, ListboxValueChange };

export const listbox: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("listbox fsm runs through createListboxFsmBridge");
  }) as never,
  createBridge: createListboxFsmBridge,
  commands: [
    "selectValue",
    "setValue",
    "selectAll",
    "clearValue",
    "highlightValue",
    "clearHighlightedValue",
    "highlightFirst",
    "highlightLast",
    "highlightNext",
    "highlightPrevious",
    "focus",
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
        highlightedIndex: change.highlightedIndex,
      }),
    },
    select: {
      on: "onSelect",
      detail: (change: ListboxSelect) => ({ value: change.value }),
    },
  },
};
