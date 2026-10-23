import type { EventUnion } from "@spin/runtime/fsm";

export interface TreeEvents {
  "EXPANDED.SET": { value?: string[]; expandedValue?: string[] };
  "EXPANDED.CLEAR": {};
  "BRANCH.EXPAND": { value: string[] };
  "BRANCH.COLLAPSE": { value: string[] };
  "BRANCH.TOGGLE": { value: string };
  "SELECTED.SET": { value?: string[]; selectedValue?: string[] };
  "SELECTED.CLEAR": {};
  "NODE.SELECT": { value: string };
  "NODE.DESELECT": { value: string };
  "CHECKED.TOGGLE": { value: string };
  "CHECKED.SET": { value?: string[]; checkedValue?: string[] };
  "CHECKED.CLEAR": {};
  "NODE.FOCUS": { value: string | null };
  "NODE.ARROW_DOWN": {};
  "NODE.ARROW_UP": {};
  "NODE.ARROW_LEFT": { value: string };
  "BRANCH_NODE.ARROW_LEFT": { value: string };
  "BRANCH_NODE.ARROW_RIGHT": { value: string };
  "NODE.HOME": {};
  "NODE.END": {};
  "NODE.CLICK": { value: string; shiftKey?: boolean; ctrlKey?: boolean };
  "BRANCH_NODE.CLICK": { value: string; shiftKey?: boolean; ctrlKey?: boolean };
  "TREE.TYPEAHEAD": { key: string };
  "NODE.RENAME": { value: string };
  "RENAME.SUBMIT": { value: string; label: string };
  "RENAME.CANCEL": {};
  "NODE.LOAD_START": { value: string };
  "NODE.LOAD_DONE": { value: string };
}

export type TreeEvent = EventUnion<TreeEvents>;