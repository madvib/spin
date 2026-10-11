import type { MachineDef } from "@spin/runtime";
import { createComboboxFsmBridge } from "./combobox.bridge.ts";
import type {
  ComboboxHighlightChange,
  ComboboxInputValueChange,
  ComboboxOpenChange,
  ComboboxSelect,
  ComboboxValueChange,
} from "./combobox.bridge.ts";

/**
 * The combobox's seam: the bridge, the element's imperative commands and the
 * CustomEvents the host reads.
 *
 * `machine`/`connect` are inert placeholders — the def's `createBridge` routes
 * straight to the fork, which is what makes this interpreter a drop-in behind
 * the `<name>.machine-def.ts` contract the plugin consumes.
 *
 * Events are faithful to Zag's callbacks: `value-change` carries
 * `onValueChange` with the new keys and the items they resolve to,
 * `highlight-change` carries `onHighlightChange` with the row it names,
 * `input-value-change` carries `onInputValueChange` with the reason the text
 * moved, `open-change` carries `onOpenChange` with the panel's state and the
 * gesture's reason, and `select` carries `onSelect` with the value the pick
 * landed on.
 */

export type {
  ComboboxHighlightChange,
  ComboboxInputValueChange,
  ComboboxOpenChange,
  ComboboxSelect,
  ComboboxValueChange,
};

export const combobox: MachineDef = {
  machine: {},
  connect: (() => {
    throw new Error("combobox fsm runs through createComboboxFsmBridge");
  }) as never,
  createBridge: createComboboxFsmBridge,
  commands: [
    "syncSelectedItems",
    "setHighlightValue",
    "clearHighlightValue",
    "selectValue",
    "setValue",
    "setInputValue",
    "clearValue",
    "focus",
    "setOpen",
  ],
  events: {
    "value-change": {
      on: "onValueChange",
      detail: (change: ComboboxValueChange) => ({ value: change.value, items: change.items }),
    },
    "highlight-change": {
      on: "onHighlightChange",
      detail: (change: ComboboxHighlightChange) => ({
        highlightedValue: change.highlightedValue,
        highlightedItem: change.highlightedItem,
      }),
    },
    "input-value-change": {
      on: "onInputValueChange",
      detail: (change: ComboboxInputValueChange) => ({
        inputValue: change.inputValue,
        reason: change.reason,
      }),
    },
    "open-change": {
      on: "onOpenChange",
      detail: (change: ComboboxOpenChange) => ({
        open: change.open,
        reason: change.reason,
        value: change.value,
      }),
    },
    select: {
      on: "onSelect",
      detail: (change: ComboboxSelect) => ({ value: change.value, itemValue: change.itemValue }),
    },
  },
};
