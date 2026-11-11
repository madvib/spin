import { createMachine, type Machine } from "@spinjs/components/fsm";
import {
  initial,
  type TreeArgs,
  type TreeContext,
  type TreeState,
} from "./tree-view.state.ts";
import type { TreeEvents } from "./tree-view.events.ts";
import {
  branchCollapse,
  branchExpand,
  checkedClear,
  checkedSet,
  checkedToggle,
  expandedClear,
  expandedSet,
  expandOnClickGuard,
  extendSelectionToNode,
  isMultiToggle,
  isRangeExtend,
  loadDone,
  loadStart,
  nodeDeselect,
  nodeFocus,
  nodeRename,
  renameCancel,
  renameSubmit,
  selectedClear,
  selectedSet,
  selectNode,
  toggleBranch,
  toggleNodeSelection,
} from "./tree-view.transitions.ts";
import { nodesOf } from "./tree-view.state.ts";

export { nodesOf };

export function treeView(
  args: TreeArgs = {},
  authored: (name: string) => boolean = () => true,
): Machine<TreeContext, TreeEvents, TreeState> {
  return createMachine<TreeContext, TreeEvents, TreeState>({
    id: "tree-view",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      nodes: { parse: nodesOf },
      expandedValue: { event: "EXPANDED.SET" },
      selectedValue: { event: "SELECTED.SET" },
      checkedValue: { event: "CHECKED.SET" },
      selectionMode: {},
      expandOnClick: {},
      rename: {},
      typeaheadEnabled: {},
      loadChildren: {},
    },
    on: {
      "EXPANDED.SET": { assign: expandedSet },
      "EXPANDED.CLEAR": { assign: expandedClear },
      "SELECTED.SET": { assign: selectedSet },
      "SELECTED.CLEAR": { assign: selectedClear },
      "CHECKED.SET": { assign: checkedSet },
      "CHECKED.CLEAR": { assign: checkedClear },
      "CHECKED.TOGGLE": { assign: checkedToggle },
      "NODE.FOCUS": { assign: nodeFocus },
      "BRANCH.TOGGLE": { assign: toggleBranch },
      "BRANCH.EXPAND": { assign: branchExpand },
      "BRANCH.COLLAPSE": { assign: branchCollapse },
      "NODE.LOAD_START": { assign: loadStart },
      "NODE.LOAD_DONE": { assign: loadDone },
    },
    states: {
      idle: {
        on: {
          "NODE.SELECT": { assign: selectNode },
          "NODE.DESELECT": { assign: nodeDeselect },
          "NODE.CLICK": [
            { cond: isMultiToggle, assign: toggleNodeSelection },
            { cond: isRangeExtend, assign: extendSelectionToNode },
            { assign: selectNode },
          ],
          "BRANCH_NODE.CLICK": [
            { cond: isMultiToggle, assign: toggleNodeSelection },
            { cond: isRangeExtend, assign: extendSelectionToNode },
            { cond: expandOnClickGuard, assign: [selectNode, toggleBranch] },
            { assign: selectNode },
          ],
          "NODE.RENAME": {
            target: "renaming",
            assign: nodeRename,
          },
        },
      },
      renaming: {
        on: {
          "RENAME.SUBMIT": {
            target: "idle",
            assign: renameSubmit,
          },
          "RENAME.CANCEL": {
            target: "idle",
            assign: renameCancel,
          },
        },
      },
    },
  });
}
