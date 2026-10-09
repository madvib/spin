import type { MachineDef } from "@spin/runtime";
import { machine, connect } from "@zag-js/tree-view";
import { TreeCollection } from "@zag-js/collection";

/**
 * The tree-view's Zag wiring.
 *
 * The machine needs `collection: TreeCollection`, a constructed object —
 * scope props arrive as plain data, so `toMachineProps` builds it from raw
 * `nodes` here, beside the machine that consumes it. Plain
 * `{ value, label, children? }` nodes need no options: the collection's
 * fallbacks read exactly those fields. One collection per nodes identity:
 * the props getter runs on every machine read, and rebuilding the tree each
 * time is garbage churn.
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

let cachedCollection: { nodes: unknown; collection: TreeCollection<TreeNode> } | undefined;

export const treeView: MachineDef = {
  machine,
  connect,
  toMachineProps: (values) => {
    if (cachedCollection === undefined || cachedCollection.nodes !== values.nodes) {
      cachedCollection = {
        nodes: values.nodes,
        collection: new TreeCollection<TreeNode>({
          rootNode: { value: "ROOT", label: "", children: (values.nodes ?? []) as TreeNode[] },
        }),
      };
    }
    return { collection: cachedCollection.collection };
  },
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
