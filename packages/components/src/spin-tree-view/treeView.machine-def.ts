import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/tree-view";

/**
 * The tree-view's Zag wiring.
 *
 * The machine needs `collection`, a constructed object scope props cannot
 * express — so it is DECLARED here (`collection: { kind: "tree", from:
 * "nodes" }`) and built by the adapter, memoized per nodes identity. Plain
 * `{ value, label, children? }` nodes need no options: the collection's
 * fallbacks read exactly those fields.
 *
 * Both events are faithful to Zag's callbacks: `expanded-change` carries
 * `onExpandedChange({ expandedValue })`, `selection-change` carries
 * `onSelectionChange({ selectedValue })`.
 */

export interface TreeNode {
  readonly value: string;
  readonly label: string;
  readonly children?: readonly TreeNode[];
}

export interface TreeExpandedChange {
  readonly expandedValue: readonly string[];
}

export interface TreeSelectionChange {
  readonly selectedValue: readonly string[];
}

export const treeView: MachineDef = {
  machine,
  connect,
  collection: { kind: "tree", from: "nodes" },
  events: {
    "expanded-change": {
      on: "onExpandedChange",
      detail: (change: { expandedValue: string[] }): TreeExpandedChange => ({
        expandedValue: change.expandedValue,
      }),
    },
    "selection-change": {
      on: "onSelectionChange",
      detail: (change: { selectedValue: string[] }): TreeSelectionChange => ({
        selectedValue: change.selectedValue,
      }),
    },
  },
};
