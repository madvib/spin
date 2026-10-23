import type { AssignFor, GuardFor } from "@spin/runtime/fsm";
import type { TreeEvents } from "./tree-view.events.ts";
import type { TreeContext } from "./tree-view.state.ts";
import { keysOf, sameSet } from "./tree-view.state.ts";

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

export const toggleBranch: TreeAssign<"BRANCH.TOGGLE" | "BRANCH_NODE.CLICK"> = (ctx, e) => {
  const value = "value" in e && typeof e.value === "string" ? e.value : "";
  return {
    expandedValue: ctx.expandedValue.includes(value)
      ? ctx.expandedValue.filter((v) => v !== value)
      : [...ctx.expandedValue, value],
  };
};

export const selectNode: TreeAssign<"NODE.SELECT" | "NODE.CLICK" | "BRANCH_NODE.CLICK"> = (ctx, e) => {
  const value = "value" in e && typeof e.value === "string" ? e.value : "";
  return ctx.selectionMode === "multiple"
    ? { selectedValue: [value] }
    : { selectedValue: [value] };
};

export const toggleNodeSelection: TreeAssign<"NODE.CLICK" | "BRANCH_NODE.CLICK"> = (ctx, e) => {
  const value = "value" in e && typeof e.value === "string" ? e.value : "";
  return {
    selectedValue: ctx.selectedValue.includes(value)
      ? ctx.selectedValue.filter((v) => v !== value)
      : [...ctx.selectedValue, value],
  };
};

export const extendSelectionToNode: TreeAssign<"NODE.CLICK" | "BRANCH_NODE.CLICK"> = (ctx, e) => {
  const value = "value" in e && typeof e.value === "string" ? e.value : "";
  if (ctx.selectedValue.includes(value)) return {};
  return { selectedValue: [...ctx.selectedValue, value] };
};

export const isMultiToggle: TreeGuard<"NODE.CLICK" | "BRANCH_NODE.CLICK"> = (ctx, event) => {
  return event.type === "NODE.CLICK" || event.type === "BRANCH_NODE.CLICK"
    ? Boolean(event.ctrlKey) && ctx.selectionMode === "multiple"
    : false;
};

export const isRangeExtend: TreeGuard<"NODE.CLICK" | "BRANCH_NODE.CLICK"> = (ctx, event) => {
  return event.type === "NODE.CLICK" || event.type === "BRANCH_NODE.CLICK"
    ? Boolean(event.shiftKey) && ctx.selectionMode === "multiple" &&
      ctx.selectedValue.length > 0
    : false;
};

export const expandedSet: TreeAssign<"EXPANDED.SET"> = (ctx, e) => {
  if (e.type !== "EXPANDED.SET") return {};
  const raw = e.expandedValue !== undefined ? e.expandedValue : e.value;
  if (raw === undefined) return {};
  const next = keysOf(raw);
  return sameSet(ctx.expandedValue, next) ? {} : { expandedValue: next };
};

export const expandedClear: TreeAssign<"EXPANDED.CLEAR"> = () => ({ expandedValue: [] });

export const selectedSet: TreeAssign<"SELECTED.SET"> = (ctx, e) => {
  if (e.type !== "SELECTED.SET") return {};
  const raw = e.selectedValue !== undefined ? e.selectedValue : e.value;
  if (raw === undefined) return {};
  const next = keysOf(raw);
  return sameSet(ctx.selectedValue, next) ? {} : { selectedValue: next };
};

export const selectedClear: TreeAssign<"SELECTED.CLEAR"> = () => ({ selectedValue: [] });

export const checkedSet: TreeAssign<"CHECKED.SET"> = (_ctx, e) => {
  if (e.type !== "CHECKED.SET") return {};
  const raw = e.checkedValue !== undefined ? e.checkedValue : e.value;
  if (raw === undefined) return {};
  return { checkedValue: keysOf(raw) };
};

export const checkedClear: TreeAssign<"CHECKED.CLEAR"> = () => ({ checkedValue: [] });

export const checkedToggle: TreeAssign<"CHECKED.TOGGLE"> = (ctx, e) => {
  if (e.type !== "CHECKED.TOGGLE") return {};
  return {
    checkedValue: ctx.checkedValue.includes(e.value)
      ? ctx.checkedValue.filter((v) => v !== e.value)
      : [...ctx.checkedValue, e.value],
  };
};

export const nodeFocus: TreeAssign<"NODE.FOCUS"> = (ctx, e) => {
  if (e.type !== "NODE.FOCUS") return {};
  return e.value !== ctx.focusedValue
    ? { focusedValue: e.value, typeahead: "" }
    : {};
};

export const branchExpand: TreeAssign<"BRANCH.EXPAND"> = (ctx, e) => {
  if (e.type !== "BRANCH.EXPAND") return {};
  const next = [...ctx.expandedValue];
  for (const value of e.value) if (!next.includes(value)) next.push(value);
  return { expandedValue: next };
};

export const branchCollapse: TreeAssign<"BRANCH.COLLAPSE"> = (ctx, e) => {
  if (e.type !== "BRANCH.COLLAPSE") return {};
  const drop = new Set(e.value);
  return { expandedValue: ctx.expandedValue.filter((v) => !drop.has(v)) };
};

export const loadStart: TreeAssign<"NODE.LOAD_START"> = (ctx, e) => {
  if (e.type !== "NODE.LOAD_START") return {};
  const next: Record<string, "loading" | "loaded" | "error"> = {
    ...ctx.loadingStatus,
    [e.value]: "loading",
  };
  return { loadingStatus: next };
};

export const loadDone: TreeAssign<"NODE.LOAD_DONE"> = (ctx, e) => {
  if (e.type !== "NODE.LOAD_DONE") return {};
  const next: Record<string, "loading" | "loaded" | "error"> = {
    ...ctx.loadingStatus,
    [e.value]: "loaded",
  };
  return { loadingStatus: next };
};

export const nodeDeselect: TreeAssign<"NODE.DESELECT"> = (ctx, e) => {
  const value = "value" in e && typeof e.value === "string" ? e.value : "";
  return { selectedValue: ctx.selectedValue.filter((v) => v !== value) };
};

export const nodeRename: TreeAssign<"NODE.RENAME"> = (_ctx, e) => {
  if (e.type !== "NODE.RENAME") return {};
  return { renamingValue: e.value, focusedValue: e.value };
};

export const renameSubmit: TreeAssign<"RENAME.SUBMIT"> = () => ({ renamingValue: null });

export const renameCancel: TreeAssign<"RENAME.CANCEL"> = () => ({ renamingValue: null });

export const expandOnClickGuard: TreeGuard<"BRANCH_NODE.CLICK"> = (ctx) => ctx.expandOnClick;