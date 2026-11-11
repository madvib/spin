import type { AssignFor, GuardFor } from "@spinjs/components/fsm";
import type { TreeEvents } from "./tree-view.events.ts";
import type { TreeContext, TreeNodeShape } from "./tree-view.state.ts";
import { keysOf, nodesOf, sameSet } from "./tree-view.state.ts";

type TreeAssign<K extends keyof TreeEvents = keyof TreeEvents> = AssignFor<
  TreeContext,
  TreeEvents,
  K
>;
type TreeGuard<K extends keyof TreeEvents = keyof TreeEvents> = GuardFor<
  TreeContext,
  TreeEvents,
  K
>;

export const toggleBranch: TreeAssign<"BRANCH.TOGGLE" | "BRANCH_NODE.CLICK"> = (
  ctx,
  e,
) => {
  const value = "value" in e && typeof e.value === "string" ? e.value : "";
  return {
    expandedValue: ctx.expandedValue.includes(value)
      ? ctx.expandedValue.filter((v) => v !== value)
      : [...ctx.expandedValue, value],
  };
};

export const selectNode: TreeAssign<
  "NODE.SELECT" | "NODE.CLICK" | "BRANCH_NODE.CLICK"
> = (ctx, e) => {
  const value = "value" in e && typeof e.value === "string" ? e.value : "";
  return ctx.selectionMode === "multiple"
    ? { selectedValue: [value] }
    : { selectedValue: [value] };
};

export const toggleNodeSelection: TreeAssign<
  "NODE.CLICK" | "BRANCH_NODE.CLICK"
> = (ctx, e) => {
  const value = "value" in e && typeof e.value === "string" ? e.value : "";
  return {
    selectedValue: ctx.selectedValue.includes(value)
      ? ctx.selectedValue.filter((v) => v !== value)
      : [...ctx.selectedValue, value],
  };
};

export const extendSelectionToNode: TreeAssign<
  "NODE.CLICK" | "BRANCH_NODE.CLICK"
> = (ctx, e) => {
  const value = "value" in e && typeof e.value === "string" ? e.value : "";
  if (ctx.selectedValue.includes(value)) return {};
  return { selectedValue: [...ctx.selectedValue, value] };
};

export const isMultiToggle: TreeGuard<"NODE.CLICK" | "BRANCH_NODE.CLICK"> = (
  ctx,
  event,
) => {
  return event.type === "NODE.CLICK" || event.type === "BRANCH_NODE.CLICK"
    ? Boolean(event.ctrlKey) && ctx.selectionMode === "multiple"
    : false;
};

export const isRangeExtend: TreeGuard<"NODE.CLICK" | "BRANCH_NODE.CLICK"> = (
  ctx,
  event,
) => {
  return event.type === "NODE.CLICK" || event.type === "BRANCH_NODE.CLICK"
    ? Boolean(event.shiftKey) && ctx.selectionMode === "multiple" &&
      ctx.selectedValue.length > 0
    : false;
};

export const expandedSet: TreeAssign<"EXPANDED.SET"> = (ctx, e) => {
  const raw = e.expandedValue !== undefined ? e.expandedValue : e.value;
  if (raw === undefined) return {};
  const next = keysOf(raw);
  return sameSet(ctx.expandedValue, next) ? {} : { expandedValue: next };
};

export const expandedClear: TreeAssign<"EXPANDED.CLEAR"> = () => ({
  expandedValue: [],
});

export const selectedSet: TreeAssign<"SELECTED.SET"> = (ctx, e) => {
  const raw = e.selectedValue !== undefined ? e.selectedValue : e.value;
  if (raw === undefined) return {};
  const next = keysOf(raw);
  return sameSet(ctx.selectedValue, next) ? {} : { selectedValue: next };
};

export const selectedClear: TreeAssign<"SELECTED.CLEAR"> = () => ({
  selectedValue: [],
});

export const checkedSet: TreeAssign<"CHECKED.SET"> = (_ctx, e) => {
  const raw = e.checkedValue !== undefined ? e.checkedValue : e.value;
  if (raw === undefined) return {};
  return { checkedValue: keysOf(raw) };
};

export const checkedClear: TreeAssign<"CHECKED.CLEAR"> = () => ({
  checkedValue: [],
});

export const checkedToggle: TreeAssign<"CHECKED.TOGGLE"> = (ctx, e) => ({
  checkedValue: ctx.checkedValue.includes(e.value)
    ? ctx.checkedValue.filter((v) => v !== e.value)
    : [...ctx.checkedValue, e.value],
});

export const nodeFocus: TreeAssign<"NODE.FOCUS"> = (ctx, e) =>
  e.value !== ctx.focusedValue ? { focusedValue: e.value, typeahead: "" } : {};

export const branchExpand: TreeAssign<"BRANCH.EXPAND"> = (ctx, e) => {
  const next = [...ctx.expandedValue];
  for (const value of e.value) if (!next.includes(value)) next.push(value);
  return { expandedValue: next };
};

export const branchCollapse: TreeAssign<"BRANCH.COLLAPSE"> = (ctx, e) => {
  const drop = new Set(e.value);
  return { expandedValue: ctx.expandedValue.filter((v) => !drop.has(v)) };
};

export const loadStart: TreeAssign<"NODE.LOAD_START"> = (ctx, e) => ({
  loadingStatus: {
    ...ctx.loadingStatus,
    [e.value]: "loading",
  },
});

const graftChildren = (
  list: readonly TreeNodeShape[],
  target: string,
  added: readonly TreeNodeShape[],
): TreeNodeShape[] =>
  list.map((item) => {
    if (item.value !== target) {
      return item.children !== undefined
        ? { ...item, children: graftChildren(item.children, target, added) }
        : item;
    }
    const have = new Set((item.children ?? []).map((child) => child.value));
    const fresh = added.filter((child) => !have.has(child.value));
    if (fresh.length === 0) return item;
    return { ...item, children: [...(item.children ?? []), ...fresh] };
  });

export const loadDone: TreeAssign<"NODE.LOAD_DONE"> = (ctx, e) => ({
  loadingStatus: {
    ...ctx.loadingStatus,
    [e.value]: "loaded",
  },
  ...(e.children !== undefined
    ? { nodes: graftChildren(ctx.nodes, e.value, nodesOf(e.children)) }
    : {}),
});

export const nodeDeselect: TreeAssign<"NODE.DESELECT"> = (ctx, e) => ({
  selectedValue: ctx.selectedValue.filter((v) => v !== e.value),
});

export const nodeRename: TreeAssign<"NODE.RENAME"> = (_ctx, e) => ({
  renamingValue: e.value,
  focusedValue: e.value,
});

const renameInTree = (
  list: readonly TreeNodeShape[],
  target: string,
  label: string,
): TreeNodeShape[] =>
  list.map((item) =>
    item.value === target
      ? { ...item, label }
      : item.children !== undefined
      ? { ...item, children: renameInTree(item.children, target, label) }
      : item
  );

export const renameSubmit: TreeAssign<"RENAME.SUBMIT"> = (ctx, e) => {
  const trimmed = e.label.trim();
  return {
    renamingValue: null,
    ...(trimmed.length > 0
      ? { nodes: renameInTree(ctx.nodes, e.value, trimmed) }
      : {}),
  };
};

export const renameCancel: TreeAssign<"RENAME.CANCEL"> = () => ({
  renamingValue: null,
});
export const expandOnClickGuard: TreeGuard<"BRANCH_NODE.CLICK"> = (ctx) =>
  ctx.expandOnClick;
