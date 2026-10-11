import type { MachineDef } from "@spin/runtime";
import { createTreeBridge } from "./tree-view.bridge.ts";

/**
 * The tree-view machine-def: the seam file codegen finds by consume name.
 *
 * `machine`/`connect` are inert placeholders — the bridge path bypasses the
 * Zag adapter entirely, which is what makes this interpreter a drop-in
 * behind the same `<name>.machine-def.ts` contract.
 */

export interface TreeExpandedChange {
  readonly expandedValue: readonly string[];
}
export interface TreeSelectionChange {
  readonly selectedValue: readonly string[];
}
export interface TreeFocusChange {
  readonly focusedValue: string | null;
}
export interface TreeCheckedChange {
  readonly checkedValue: readonly string[];
}
export interface TreeLoadComplete {
  readonly value: string;
}

export const treeView: MachineDef = {
  createBridge: createTreeBridge,
  events: {
    "expanded-change": {
      on: "onExpandedChange",
      detail: (c: TreeExpandedChange) => ({ expandedValue: c.expandedValue }),
    },
    "selection-change": {
      on: "onSelectionChange",
      detail: (c: TreeSelectionChange) => ({ selectedValue: c.selectedValue }),
    },
    "focus-change": {
      on: "onFocusChange",
      detail: (c: TreeFocusChange) => ({ focusedValue: c.focusedValue }),
    },
    "checked-change": {
      on: "onCheckedChange",
      detail: (c: TreeCheckedChange) => ({ checkedValue: c.checkedValue }),
    },
    "load-complete": {
      on: "onLoadComplete",
      detail: (c: TreeLoadComplete) => ({ value: c.value }),
    },
  },
};
