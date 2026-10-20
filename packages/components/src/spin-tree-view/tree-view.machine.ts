/**
 * Tree-view on the forked FSM — the hard case, deliberately.
 *
 * Why this machine is the test: it is the one Zag component whose
 * complexity is NOT a state chart. Thirty-ish events (expand, collapse,
 * select, check, arrows at every depth, typeahead, rename, lazy load) with
 * per-node state (loading, rename mode) and per-selection-mode semantics.
 * If the config-first fork holds here — small, legible config with a
 * table of pure assigns and named guards beside it — the architecture is
 * proven. If it degenerates into flag-soup, we learn the boundary.
 *
 * Two things make it work, and both are the reusable ideas:
 *
 * 1. **`TreeCollection` is unnecessary.** Zag ships a 19kB collection class
 *    to answer "what is visible". Here it is a derived computation over the
 *    raw tree plus `expandedValue` — the reactive core does the work, and
 *    the visible-row list is a plain function the template iterates.
 * 2. **Per-node async state lives in context maps.** `loadingStatus` is a
 *    record keyed by node value; the async WORK lives in an action (which
 *    owns its abort map, as the machine's `refs.pendingAborts` did), and
 *    talks to the machine in events. No actors required for this.
 */
/**
 * Tree-view machine: the config and its vocabulary. States, events, guards,
 * and pure assigns. The bridge (`bridge.ts`) turns scope values into this
 * machine; the connect (`connect.ts`) turns machine state into DOM.
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

export interface TreeInitial {
  readonly nodes?: unknown;
  readonly expandedValue?: unknown;
  readonly selectedValue?: unknown;
  readonly defaultExpandedValue?: unknown;
  readonly defaultSelectedValue?: unknown;
  readonly defaultCheckedValue?: unknown;
  readonly selectionMode?: unknown;
  readonly expandOnClick?: unknown;
  readonly rename?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export interface TreeNodeShape {
  readonly value: string;
  readonly label: string;
  readonly children?: readonly TreeNodeShape[] | undefined;
}

/** A node entry: value names it, the rest is text; children recurse.
 * Malformed entries drop; anything else is no nodes. */
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

/** The tree off any transport: the scope grammar has no recursive shape,
 * so the collection parses here. Well-shaped entries only. */
export function nodesOf(raw: unknown): TreeNodeShape[] {
  const list: readonly unknown[] = Array.isArray(raw) ? raw : [];
  const out: TreeNodeShape[] = [];
  for (const entry of list) {
    const shaped = shapeNode(entry);
    if (shaped !== null) out.push(shaped);
  }
  return out;
}

/** Seed shaping: the three value sets start at their defaults, empty. */
export function initial(
  raw: TreeInitial,
  authored: (name: string) => boolean,
): Pick<TreeContext, "expandedValue" | "selectedValue" | "checkedValue" | "selectionMode" | "expandOnClick" | "rename"> {
  const keysOf = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === "string");
  };
  // The scope's `expandedValue` and `selectedValue` default to [], so an
  // unauthored value looks present. The authored predicate is what says
  // whether the host chose it.
  return {
    expandedValue: authored("expandedValue") ? keysOf(raw.expandedValue) : keysOf(raw.defaultExpandedValue),
    selectedValue: authored("selectedValue") ? keysOf(raw.selectedValue) : keysOf(raw.defaultSelectedValue),
    checkedValue: keysOf(raw.defaultCheckedValue),
    selectionMode: raw.selectionMode === "multiple" ? "multiple" : "single",
    expandOnClick: raw.expandOnClick !== false,
    rename: raw.rename !== false,
  };
}

/** Two sets with the same members: an assign returning no-op is an event
 * that moved nothing, and the bridge's change detection depends on it. */
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
  /** Props the guards read. Synced per send from scope values. */
  selectionMode: "single" | "multiple";
  expandOnClick: boolean;
  rename: boolean;
}

/**
 * Callbacks live on the prop channel, not in context: the machine's context
 * stays pure state (serializable for the studio), and the bridge fires these
 * after a send when the matching field moved.
 */
export interface TreeCallbacks {
  onExpandedChange: ((details: TreeExpandedChange) => void) | undefined;
  onSelectionChange: ((details: TreeSelectionChange) => void) | undefined;
  onFocusChange: ((details: TreeFocusChange) => void) | undefined;
  onCheckedChange: ((details: TreeCheckedChange) => void) | undefined;
  onLoadComplete: ((details: TreeLoadComplete) => void) | undefined;
}

export type TreeEvent =
  | { type: "EXPANDED.SET"; value: string[] }
  | { type: "EXPANDED.CLEAR" }
  | { type: "BRANCH.EXPAND"; value: string[] }
  | { type: "BRANCH.COLLAPSE"; value: string[] }
  | { type: "BRANCH.TOGGLE"; value: string }
  | { type: "SELECTED.SET"; value: string[] }
  | { type: "SELECTED.CLEAR" }
  | { type: "NODE.SELECT"; value: string }
  | { type: "NODE.DESELECT"; value: string }
  | { type: "CHECKED.TOGGLE"; value: string }
  | { type: "CHECKED.SET"; value: string[] }
  | { type: "CHECKED.CLEAR" }
  | { type: "NODE.FOCUS"; value: string | null }
  | { type: "NODE.ARROW_DOWN" }
  | { type: "NODE.ARROW_UP" }
  | { type: "NODE.ARROW_LEFT"; value: string }
  | { type: "BRANCH_NODE.ARROW_LEFT"; value: string }
  | { type: "BRANCH_NODE.ARROW_RIGHT"; value: string }
  | { type: "NODE.HOME" }
  | { type: "NODE.END" }
  | { type: "NODE.CLICK"; value: string; shiftKey?: boolean; ctrlKey?: boolean }
  | {
    type: "BRANCH_NODE.CLICK";
    value: string;
    shiftKey?: boolean;
    ctrlKey?: boolean;
  }
  | { type: "TREE.TYPEAHEAD"; key: string }
  | { type: "NODE.RENAME"; value: string }
  | { type: "RENAME.SUBMIT"; value: string; label: string }
  | { type: "RENAME.CANCEL" }
  | { type: "NODE.LOAD_START"; value: string }
  | { type: "NODE.LOAD_DONE"; value: string };

export const config = {
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
    "EXPANDED.SET": { actions: [{ assign: "setExpanded" }] },
    "EXPANDED.CLEAR": { actions: [{ assign: "clearExpanded" }] },
    "SELECTED.SET": { actions: [{ assign: "setSelected" }] },
    "SELECTED.CLEAR": { actions: [{ assign: "clearSelected" }] },
    "CHECKED.SET": { actions: [{ assign: "setChecked" }] },
    "CHECKED.CLEAR": { actions: [{ assign: "clearChecked" }] },
    "CHECKED.TOGGLE": { actions: [{ assign: "toggleChecked" }] },
    "NODE.FOCUS": { actions: [{ assign: "setFocused" }] },
    "BRANCH.TOGGLE": { actions: [{ assign: "toggleBranch" }] },
    "BRANCH.EXPAND": { actions: [{ assign: "expandBranches" }] },
    "BRANCH.COLLAPSE": { actions: [{ assign: "collapseBranches" }] },
    "NODE.LOAD_START": { actions: [{ assign: "loadStart" }] },
    "NODE.LOAD_DONE": { actions: [{ assign: "loadDone" }] },
  },
  states: {
    idle: {
      on: {
        "NODE.SELECT": { actions: [{ assign: "selectNode" }] },
        "NODE.DESELECT": { actions: [{ assign: "deselectNode" }] },
        "NODE.CLICK": [
          {
            cond: "isMultiToggle",
            actions: [{ assign: "toggleNodeSelection" }],
          },
          {
            cond: "isRangeExtend",
            actions: [{ assign: "extendSelectionToNode" }],
          },
          { actions: [{ assign: "selectNode" }] },
        ],
        "BRANCH_NODE.CLICK": [
          {
            cond: "isMultiToggle",
            actions: [{ assign: "toggleNodeSelection" }],
          },
          {
            cond: "isRangeExtend",
            actions: [{ assign: "extendSelectionToNode" }],
          },
          {
            cond: "expandOnClick",
            actions: [{ assign: "selectNode" }, { assign: "toggleBranch" }],
          },
          { actions: [{ assign: "selectNode" }] },
        ],
        "NODE.RENAME": {
          target: "renaming",
          actions: [{ assign: "setRenaming" }],
        },
      },
    },
    renaming: {
      on: {
        "RENAME.SUBMIT": {
          target: "idle",
          actions: [{ assign: "submitRename" }],
        },
        "RENAME.CANCEL": {
          target: "idle",
          actions: [{ assign: "cancelRename" }],
        },
      },
    },
  },
};

/**
 * The four members of the vocabulary the config references. Navigation
 * (arrows/home/end/typeahead) is NOT here: those need the visible-node
 * list, which is a *view* concern — they live as the `use:navigate` action
 * plus connect handlers, and send events this machine answers. The
 * guards/assigns below are pure transforms of state only.
 */
export const implementations = {
  conds: {
    isMultiToggle: (ctx: TreeContext, event: TreeEvent) =>
      event.type === "NODE.CLICK" || event.type === "BRANCH_NODE.CLICK"
        ? Boolean(event.ctrlKey) && ctx.selectionMode === "multiple"
        : false,
    isRangeExtend: (ctx: TreeContext, event: TreeEvent) =>
      event.type === "NODE.CLICK" || event.type === "BRANCH_NODE.CLICK"
        ? Boolean(event.shiftKey) && ctx.selectionMode === "multiple" &&
          ctx.selectedValue.length > 0
        : false,
    expandOnClick: (ctx: TreeContext) => ctx.expandOnClick,
  },
  assigns: {
    setExpanded: (_ctx: TreeContext, e: TreeEvent) =>
      e.type === "EXPANDED.SET" && !sameSet(_ctx.expandedValue, e.value)
        ? { expandedValue: [...e.value] }
        : {},
    clearExpanded: (_ctx: TreeContext) => ({ expandedValue: [] }),
    setSelected: (_ctx: TreeContext, e: TreeEvent) =>
      e.type === "SELECTED.SET" && !sameSet(_ctx.selectedValue, e.value)
        ? { selectedValue: [...e.value] }
        : {},
    clearSelected: () => ({ selectedValue: [] }),
    toggleChecked: (ctx: TreeContext, e: TreeEvent) =>
      e.type === "CHECKED.TOGGLE"
        ? {
          checkedValue: ctx.checkedValue.includes(e.value)
            ? ctx.checkedValue.filter((v) => v !== e.value)
            : [...ctx.checkedValue, e.value],
        }
        : {},
    setChecked: (_ctx: TreeContext, e: TreeEvent) =>
      e.type === "CHECKED.SET" ? { checkedValue: [...e.value] } : {},
    clearChecked: () => ({ checkedValue: [] }),
    setFocused: (ctx: TreeContext, e: TreeEvent) =>
      e.type === "NODE.FOCUS" && e.value !== ctx.focusedValue
        ? { focusedValue: e.value, typeahead: "" }
        : {},
    // No event-type guard: this assign is composed into BRANCH.TOGGLE and
    // BRANCH_NODE.CLICK. An assign that must know WHICH event fired it is a
    // modeling error — split the transitions instead.
    toggleBranch: (ctx: TreeContext, e: TreeEvent): Partial<TreeContext> => {
      const value = "value" in e ? (e.value as string) : "";
      return {
        expandedValue: ctx.expandedValue.includes(value)
          ? ctx.expandedValue.filter((v) => v !== value)
          : [...ctx.expandedValue, value],
      };
    },
    expandBranches: (ctx: TreeContext, e: TreeEvent) => {
      if (e.type !== "BRANCH.EXPAND") return {};
      const next = [...ctx.expandedValue];
      for (const value of e.value) if (!next.includes(value)) next.push(value);
      return { expandedValue: next };
    },
    collapseBranches: (ctx: TreeContext, e: TreeEvent) => {
      if (e.type !== "BRANCH.COLLAPSE") return {};
      const drop = new Set(e.value);
      return { expandedValue: ctx.expandedValue.filter((v) => !drop.has(v)) };
    },
    selectNode: (_ctx: TreeContext, e: TreeEvent) => {
      const value = (e as { value: string }).value;
      return _ctx.selectionMode === "multiple"
        ? { selectedValue: [value] }
        : { selectedValue: [value] };
    },
    deselectNode: (ctx: TreeContext, e: TreeEvent) => {
      const value = (e as { value: string }).value;
      return { selectedValue: ctx.selectedValue.filter((v) => v !== value) };
    },
    toggleNodeSelection: (ctx: TreeContext, e: TreeEvent) => {
      const value = (e as { value: string }).value;
      return {
        selectedValue: ctx.selectedValue.includes(value)
          ? ctx.selectedValue.filter((v) => v !== value)
          : [...ctx.selectedValue, value],
      };
    },
    extendSelectionToNode: (ctx: TreeContext, e: TreeEvent) => {
      const value = (e as { value: string }).value;
      if (ctx.selectedValue.includes(value)) return {};
      return { selectedValue: [...ctx.selectedValue, value] };
    },
    setRenaming: (_ctx: TreeContext, e: TreeEvent) =>
      e.type === "NODE.RENAME"
        ? { renamingValue: e.value, focusedValue: e.value }
        : {},
    submitRename: (_ctx: TreeContext) => ({ renamingValue: null }),
    cancelRename: () => ({ renamingValue: null }),
    loadStart: (ctx: TreeContext, e: TreeEvent): Partial<TreeContext> => {
      if (e.type !== "NODE.LOAD_START") return {};
      const next: Record<string, "loading" | "loaded" | "error"> = {
        ...ctx.loadingStatus,
        [e.value]: "loading",
      };
      return { loadingStatus: next };
    },
    loadDone: (ctx: TreeContext, e: TreeEvent): Partial<TreeContext> => {
      if (e.type !== "NODE.LOAD_DONE") return {};
      const next: Record<string, "loading" | "loaded" | "error"> = {
        ...ctx.loadingStatus,
        [e.value]: "loaded",
      };
      return { loadingStatus: next };
    },
  },
  // No `actions` table: every transition is a pure assign. The out-side
  // callbacks fire from the bridge after each send, guarded by a change
  // snapshot, so "no-op event" means no event anywhere — not a stale one
  // replayed.
};
