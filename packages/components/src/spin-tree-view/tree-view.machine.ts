/**
 * Tree-view on the forked FSM — the hard case, deliberately.
 */

import { coerceJsonArray, defaultTwin, isRecord } from "@spin/runtime";
import { createMachine, type Machine, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
const toggleBranch = (ctx: TreeContext, e: TreeEvent) : Partial<TreeContext> => {
      const value = "value" in e ? (e.value as string) : "";
      return {
        expandedValue: ctx.expandedValue.includes(value)
          ? ctx.expandedValue.filter((v) => v !== value)
          : [...ctx.expandedValue, value],
      };
    };

const selectNode = (_ctx: TreeContext, e: TreeEvent) => {
      const value = (e as { value: string }).value;
      return _ctx.selectionMode === "multiple"
        ? { selectedValue: [value] }
        : { selectedValue: [value] };
    };

const toggleNodeSelection = (ctx: TreeContext, e: TreeEvent) => {
      const value = (e as { value: string }).value;
      return {
        selectedValue: ctx.selectedValue.includes(value)
          ? ctx.selectedValue.filter((v) => v !== value)
          : [...ctx.selectedValue, value],
      };
    };

const extendSelectionToNode = (ctx: TreeContext, e: TreeEvent) => {
      const value = (e as { value: string }).value;
      if (ctx.selectedValue.includes(value)) return {};
      return { selectedValue: [...ctx.selectedValue, value] };
    };

const isMultiToggle = (ctx: TreeContext, event: EventUnion<TreeEvents>) => { return event.type === "NODE.CLICK" || event.type === "BRANCH_NODE.CLICK"
        ? Boolean(event.ctrlKey) && ctx.selectionMode === "multiple"
        : false; };

const isRangeExtend = (ctx: TreeContext, event: EventUnion<TreeEvents>) => { return event.type === "NODE.CLICK" || event.type === "BRANCH_NODE.CLICK"
        ? Boolean(event.shiftKey) && ctx.selectionMode === "multiple" &&
          ctx.selectedValue.length > 0
        : false; };


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

/**
 * The tree-view's arguments: the values the host may set.
 */
export interface TreeArgs {
  readonly expandedValue?: readonly string[];
  readonly selectedValue?: readonly string[];
  readonly checkedValue?: readonly string[];
  readonly selectionMode?: string;
  readonly expandOnClick?: boolean;
  readonly rename?: boolean;
}


export interface TreeNodeShape {
  readonly value: string;
  readonly label: string;
  readonly children?: readonly TreeNodeShape[] | undefined;
}

/** Malformed entries drop. */
const shapeNode = (entry: unknown): TreeNodeShape | null => {
  if (!isRecord(entry)) return null;
  const value: unknown = entry["value"];
  if (typeof value !== "string") return null;
  const label: unknown = entry["label"];
  const node: { value: string; label: string; children?: TreeNodeShape[] } = {
    value,
    label: typeof label === "string" ? label : "",
  };
  const kids: unknown = entry["children"];
  if (kids !== undefined) {
    if (!Array.isArray(kids)) return null;
    const shaped: TreeNodeShape[] = [];
    for (const kid of kids) {
      const child = shapeNode(kid);
      if (child === null) return null;
      shaped.push(child);
    }
    node.children = shaped;
  }
  return node;
};

/** The scope grammar has no recursive shape, so the collection parses here. */
export function nodesOf(raw: unknown): TreeNodeShape[] {
  // `nodes` is declared as a string, so the host's write is JSON. An
  // already-parsed array is accepted too.
  const list: readonly unknown[] = typeof raw === "string"
    ? coerceJsonArray(raw, [])
    : Array.isArray(raw)
      ? raw
      : [];
  const out: TreeNodeShape[] = [];
  for (const entry of list) {
    const shaped = shapeNode(entry);
    if (shaped !== null) out.push(shaped);
  }
  return out;
}

const keysOf = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
};

export function initial(
  args: TreeArgs,
  authored: (name: string) => boolean = () => true,
): TreeContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    expandedValue: written("expandedValue") ? keysOf(args.expandedValue) : [],
    selectedValue: written("selectedValue") ? keysOf(args.selectedValue) : [],
    checkedValue: written("checkedValue") ? keysOf(args.checkedValue) : [],
    focusedValue: null,
    renamingValue: null,
    loadingStatus: {},
    typeahead: "",
    selectionMode: written("selectionMode")
      ? (args.selectionMode === "multiple" ? "multiple" : "single")
      : "single",
    expandOnClick: written("expandOnClick") ? args.expandOnClick !== false : true,
    rename: written("rename") ? args.rename !== false : true,
  };
}

/** An assign returning no-op is an event that moved nothing, and the
 * bridge's change detection depends on it. */
const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v) => b.includes(v));

export interface TreeContext {
  expandedValue: string[];
  selectedValue: string[];
  checkedValue: string[];
  focusedValue: string | null;
  renamingValue: string | null;
  loadingStatus: Record<string, "loading" | "loaded" | "error">;
  typeahead: string;
  selectionMode: "single" | "multiple";
  expandOnClick: boolean;
  rename: boolean;
}

/**
 * Callbacks live on the prop channel, not in context: the context stays pure
 * state, and the bridge fires these after a send when the field moved.
 */
export interface TreeCallbacks {
  onExpandedChange: ((details: TreeExpandedChange) => void) | undefined;
  onSelectionChange: ((details: TreeSelectionChange) => void) | undefined;
  onFocusChange: ((details: TreeFocusChange) => void) | undefined;
  onCheckedChange: ((details: TreeCheckedChange) => void) | undefined;
  onLoadComplete: ((details: TreeLoadComplete) => void) | undefined;
}

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


const config: MachineSpec<TreeContext, TreeEvents> = {
  id: "tree-view",
  initial: "idle",
  context: {
    expandedValue: [] as string[],
    selectedValue: [] as string[],
    checkedValue: [] as string[],
    focusedValue: null as string | null,
    renamingValue: null as string | null,
    loadingStatus: {} as Record<string, "loading" | "loaded" | "error">,
    typeahead: "",
    selectionMode: "single" as "single" | "multiple",
    expandOnClick: true,
    rename: true,
  },
  // Root-level handlers: valid in every state, including `renaming`.
  on: {
    "EXPANDED.SET": { assign: (ctx, e) => {
      if (e.type !== "EXPANDED.SET") return {};
      // A host write names the field, a command names the set; the field wins.
      const raw = e.expandedValue !== undefined ? e.expandedValue : e.value;
      if (raw === undefined) return {};
      const next = keysOf(raw);
      return sameSet(ctx.expandedValue, next) ? {} : { expandedValue: next };
    } },
    "EXPANDED.CLEAR": { assign: (_ctx) => { return ({ expandedValue: [] }); } },
    "SELECTED.SET": { assign: (ctx, e) => {
      if (e.type !== "SELECTED.SET") return {};
      const raw = e.selectedValue !== undefined ? e.selectedValue : e.value;
      if (raw === undefined) return {};
      const next = keysOf(raw);
      return sameSet(ctx.selectedValue, next) ? {} : { selectedValue: next };
    } },
    "SELECTED.CLEAR": { assign: () => { return ({ selectedValue: [] }); } },
    "CHECKED.SET": { assign: (_ctx, e) => {
      if (e.type !== "CHECKED.SET") return {};
      const raw = e.checkedValue !== undefined ? e.checkedValue : e.value;
      if (raw === undefined) return {};
      return { checkedValue: keysOf(raw) };
    } },
    "CHECKED.CLEAR": { assign: () => { return ({ checkedValue: [] }); } },
    "CHECKED.TOGGLE": { assign: (ctx, e) => { return e.type === "CHECKED.TOGGLE"
        ? {
          checkedValue: ctx.checkedValue.includes(e.value)
            ? ctx.checkedValue.filter((v) => v !== e.value)
            : [...ctx.checkedValue, e.value],
        }
        : {}; } },
    "NODE.FOCUS": { assign: (ctx, e) => { return e.type === "NODE.FOCUS" && e.value !== ctx.focusedValue
        ? { focusedValue: e.value, typeahead: "" }
        : {}; } },
    "BRANCH.TOGGLE": { assign: toggleBranch },
    "BRANCH.EXPAND": { assign: (ctx, e) => {
      if (e.type !== "BRANCH.EXPAND") return {};
      const next = [...ctx.expandedValue];
      for (const value of e.value) if (!next.includes(value)) next.push(value);
      return { expandedValue: next };
    } },
    "BRANCH.COLLAPSE": { assign: (ctx, e) => {
      if (e.type !== "BRANCH.COLLAPSE") return {};
      const drop = new Set(e.value);
      return { expandedValue: ctx.expandedValue.filter((v) => !drop.has(v)) };
    } },
    "NODE.LOAD_START": { assign: (ctx, e) => {
      if (e.type !== "NODE.LOAD_START") return {};
      const next: Record<string, "loading" | "loaded" | "error"> = {
        ...ctx.loadingStatus,
        [e.value]: "loading",
      };
      return { loadingStatus: next };
    } },
    "NODE.LOAD_DONE": { assign: (ctx, e) => {
      if (e.type !== "NODE.LOAD_DONE") return {};
      const next: Record<string, "loading" | "loaded" | "error"> = {
        ...ctx.loadingStatus,
        [e.value]: "loaded",
      };
      return { loadingStatus: next };
    } },
  },
  states: {
    idle: {
      on: {
        "NODE.SELECT": { assign: selectNode },
        "NODE.DESELECT": { assign: (ctx, e) => {
      const value = (e as { value: string }).value;
      return { selectedValue: ctx.selectedValue.filter((v) => v !== value) };
    } },
        "NODE.CLICK": [
          {
            cond: isMultiToggle,
            assign: toggleNodeSelection,
          },
          {
            cond: isRangeExtend,
            assign: extendSelectionToNode,
          },
          { assign: selectNode },
        ],
        "BRANCH_NODE.CLICK": [
          {
            cond: isMultiToggle,
            assign: toggleNodeSelection,
          },
          {
            cond: isRangeExtend,
            assign: extendSelectionToNode,
          },
          {
            cond: (ctx) => { return ctx.expandOnClick; },
            assign: [selectNode, toggleBranch],
          },
          { assign: selectNode },
        ],
        "NODE.RENAME": {
          target: "renaming",
          assign: (_ctx, e) => { return e.type === "NODE.RENAME"
        ? { renamingValue: e.value, focusedValue: e.value }
        : {}; },
        },
      },
    },
    renaming: {
      on: {
        "RENAME.SUBMIT": {
          target: "idle",
          assign: (_ctx) => { return ({ renamingValue: null }); },
        },
        "RENAME.CANCEL": {
          target: "idle",
          assign: () => { return ({ renamingValue: null }); },
        },
      },
    },
  },
};

/**
 * Navigation (arrows/home/end/typeahead) is NOT here: it needs the
 * visible-node list, a view concern. The guards and assigns below are pure
 * transforms of state only.
 */
const implementations = {};

export function treeView(
  args: TreeArgs = {},
  authored: (name: string) => boolean = () => true,
): Machine<TreeContext, TreeEvents> {
  return createMachine<TreeContext, TreeEvents>({
    ...config,
    context: initial(args, authored),
    /**
     * The machine's contract with its hosts. A field with an event is
     * REPORTED: the host's write is an event, the machine decides, and the
     * change reaches the host. A field without one is SILENT: the write
     * lands in the field, and nothing reports.
     */
    fields: {
      expandedValue: { event: "EXPANDED.SET" },
      selectedValue: { event: "SELECTED.SET" },
      checkedValue: { event: "CHECKED.SET" },
      selectionMode: {},
      expandOnClick: {},
      rename: {},
    },
  });
}
