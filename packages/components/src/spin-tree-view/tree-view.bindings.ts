import { ariaControls, ariaHidden, dataAttr, defineComponent, disclosureTrigger, factAttrs, isRecord, optionRow, type ComponentDef, type PartScope, type SlotScope } from "@spin/runtime";
import {
  nodesOf,
  treeView as treeViewMachine,
  type TreeArgs,
  type TreeCheckedChange,
  type TreeContext,
  type TreeEvents,
  type TreeExpandedChange,
  type TreeFocusChange,
  type TreeLoadComplete,
  type TreeNodeShape,
  type TreeSelectionChange,
} from "./tree-view.machine.ts";



/**
 * Tree-view definition: the DOM contract as data. This file maps props to
 * channels, parts to attribute bags, commands to sends.
 *
 * Flattening and navigation live here, not in the machine: the visible rows
 * are derived from the tree plus `expandedValue`.
 */

export interface TreeNode {
  readonly value: string;
  readonly label: string;
  readonly children?: readonly TreeNode[] | undefined;
}

export interface VisibleRow {
  readonly node: TreeNode;
  readonly depth: number;
  readonly indexPath: number[];
}

export interface TreeItemState {
  readonly expanded: boolean;
  readonly selected: boolean;
  readonly focused: boolean;
  readonly checked: boolean;
  readonly loading: boolean;
  readonly branch: boolean;
  readonly renaming: boolean;
}

export interface TreeApi {
  readonly focusedValue: string | null;
  readonly expandedValue: string[];
  readonly selectedValue: string[];
  readonly checkedValue: string[];
  readonly renamingValue: string | null;
  readonly loadingStatus: Record<string, "loading" | "loaded" | "error">;
  readonly nodes: readonly TreeNode[];
  getVisibleRows(): readonly VisibleRow[];
  isBranch(row: VisibleRow): boolean;
  getItemState(row: VisibleRow): TreeItemState;
  getRootProps(): Record<string, unknown>;
  getTreeProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getItemProps(row: VisibleRow): Record<string, unknown>;
  getBranchControlProps(row: VisibleRow): Record<string, unknown>;
  getBranchIndicatorProps(row: VisibleRow): Record<string, unknown>;
  getItemIconProps(row: VisibleRow): Record<string, unknown>;
  getRailProps(row: VisibleRow): Record<string, unknown>;
  getBranchTextProps(row: VisibleRow): Record<string, unknown>;
  getBranchContentProps(row: VisibleRow): Record<string, unknown>;
  getCheckboxProps(row: VisibleRow): Record<string, unknown>;
  getLoadingProps(row: VisibleRow): Record<string, unknown>;
  getRenameInputProps(row: VisibleRow): Record<string, unknown>;
  startRenaming(value: string): void;
}

export type {
  TreeCheckedChange,
  TreeExpandedChange,
  TreeFocusChange,
  TreeLoadComplete,
  TreeSelectionChange,
} from "./tree-view.machine.ts";

interface ScopeLike extends PartScope<unknown, TreeContext> {}

interface SlotLike<R> extends SlotScope<R, TreeContext> {}

type IdFn = (part: string, slot?: unknown) => string;

/** Host hook for lazy branches: set as a property on the element. */
type LoadChildren = (
  value: string,
) => Promise<readonly TreeNodeShape[]> | readonly TreeNodeShape[] | void;

const isLoadChildren = (value: unknown): value is LoadChildren =>
  typeof value === "function";

const rowOf = (arg: unknown): VisibleRow => {
  if (!isRecord(arg)) return { node: { value: "", label: "" }, depth: 0, indexPath: [] };
  const node: unknown = arg["node"];
  if (!isRecord(node) || typeof node["value"] !== "string" || typeof node["label"] !== "string") {
    return { node: { value: "", label: "" }, depth: 0, indexPath: [] };
  }
  const depth: unknown = arg["depth"];
  const indexPath: unknown = arg["indexPath"];
  return {
    node: { value: node["value"], label: node["label"] },
    depth: typeof depth === "number" ? depth : 0,
    indexPath: Array.isArray(indexPath) && indexPath.every((n): n is number => typeof n === "number") ? indexPath : [],
  };
};

const inputValue = (target: EventTarget | null): string => {
  if (!isRecord(target)) return "";
  const value: unknown = target["value"];
  return typeof value === "string" ? value : "";
};

const setRootNodes = (scope: ScopeLike, json: string): void => {
  const root: unknown = scope.root();
  if (!isRecord(root)) return;
  root["nodes"] = json;
};

/** The TreeCollection replacement: the visible-row list. */
const flatten = (
  nodes: readonly TreeNode[],
  expanded: readonly string[],
): readonly VisibleRow[] => {
  const rows: VisibleRow[] = [];
  const walk = (
    list: readonly TreeNode[],
    depth: number,
    indexPath: number[],
  ): void => {
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (node === undefined) continue;
      const path = [...indexPath, i];
      rows.push({ node, depth, indexPath: path });
      const kids = node.children;
      if (kids !== undefined && kids.length > 0 && expanded.includes(node.value)) {
        walk(kids, depth + 1, path);
      }
    }
  };
  walk(nodes, 0, []);
  return rows;
};

/** Visible rows memoized on the nodes' identity and the expansion: fresh
 * rows per move would re-stamp every node and orphan gestures in flight. */
const rowsCache = new WeakMap<readonly TreeNode[], Map<string, readonly VisibleRow[]>>();
const rowsOf = (
  nodes: readonly TreeNode[],
  expanded: readonly string[],
): readonly VisibleRow[] => {
  const key = expanded.join(" ");
  let byKey = rowsCache.get(nodes);
  if (byKey === undefined) {
    byKey = new Map();
    rowsCache.set(nodes, byKey);
  }
  const hit = byKey.get(key);
  if (hit !== undefined) return hit;
  const rows = flatten(nodes, expanded);
  byKey.set(key, rows);
  return rows;
};

// Branch convention: `children: []` is a leaf; the key's ABSENCE is a
// loadable branch — lazy nodes declare no children at all.
const isBranchRow = (
  row: VisibleRow,
  loadable: boolean,
): boolean => {
  const children = row.node.children;
  if (children === undefined) return loadable;
  return children.length > 0;
};

const itemStateOf = (
  scope: ScopeLike,
  row: VisibleRow,
): TreeItemState => {
  const ctx = scope.context;
  return {
    expanded: ctx.expandedValue.includes(row.node.value),
    selected: ctx.selectedValue.includes(row.node.value),
    focused: ctx.focusedValue === row.node.value,
    checked: ctx.checkedValue.includes(row.node.value),
    loading: ctx.loadingStatus[row.node.value] === "loading",
    branch: isBranchRow(row, typeof scope.props["loadChildren"] === "function"),
    renaming: ctx.renamingValue === row.node.value,
  };
};

const iconKind = (scope: ScopeLike, row: VisibleRow): "branch-open" | "branch-closed" | "leaf" => {
  const state = itemStateOf(scope, row);
  if (!state.branch) return "leaf";
  return state.expanded ? "branch-open" : "branch-closed";
};

const stateAttrs = (state: TreeItemState): Record<string, unknown> => {
  const attrs: Record<string, unknown> = {
    "data-state": state.expanded ? "open" : "closed",
  };
  if (state.selected) attrs["data-selected"] = "";
  if (state.focused) attrs["data-focus"] = "";
  if (state.checked) attrs["data-checked"] = "";
  if (state.loading) attrs["data-loading"] = "";
  if (state.renaming) attrs["data-renaming"] = "";
  return attrs;
};

/**
 * Lazy branches: expanding a row with no children asks the host to load
 * them. The host owns the data (it rewrites the `nodes` property); the
 * machine owns the loading marker. LOAD_DONE is sent even on a rejected
 * load, so the spinner clears rather than sticking.
 */
const ensureChildren = (scope: ScopeLike, value: string): void => {
  const ctx = scope.context;
  const nodes = nodesOf(scope.props["nodes"]);
  const node = rowsOf(nodes, ctx.expandedValue).find((row) => row.node.value === value)?.node;
  if (node === undefined || (node.children !== undefined && node.children.length > 0)) return;
  const load: unknown = scope.props["loadChildren"];
  if (!isLoadChildren(load)) return;
  scope.send({ type: "NODE.LOAD_START", value });
  void (async () => {
    try {
      const loaded = await load(value);
      if (Array.isArray(loaded)) {
        const graft = (list: readonly TreeNodeShape[]): TreeNodeShape[] =>
          list.map((item) =>
            item.value === value
              ? { ...item, children: [...(item.children ?? []), ...nodesOf(loaded)] }
              : item.children !== undefined
              ? { ...item, children: graft(item.children) }
              : item
          );
        // The tree crosses the prop channel as JSON text; lazy grafting
        // writes the host's data back the same way it arrived.
        setRootNodes(scope, JSON.stringify(graft(nodes)));
      }
    } catch {
      // A failed load leaves the branch empty; the spinner clears anyway.
    } finally {
      scope.send({ type: "NODE.LOAD_DONE", value });
    }
  })();
};

/** Typeahead buffers, keyed per bridge: printable keys accumulate within
 * 500ms, and the first visible label match wins. */
const typeaheadByBridge = new WeakMap<IdFn, { keys: string; at: number }>();
const typeaheadOf = (scope: ScopeLike): { keys: string; at: number } => {
  let buffer = typeaheadByBridge.get(scope.id);
  if (buffer === undefined) {
    buffer = { keys: "", at: 0 };
    typeaheadByBridge.set(scope.id, buffer);
  }
  return buffer;
};

const rowKeydown = (scope: ScopeLike, row: VisibleRow, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  const ctx = scope.context;
  const nodes = nodesOf(scope.props["nodes"]);
  const rows = rowsOf(nodes, ctx.expandedValue);
  const at = rows.findIndex((r) => r.node.value === row.node.value);
  const loadable = typeof scope.props["loadChildren"] === "function";
  const branch = isBranchRow(row, loadable);
  const expanded = ctx.expandedValue.includes(row.node.value);
  const multiple = ctx.selectionMode === "multiple";
  const shift = event.shiftKey && multiple;
  const valueAt = (index: number): string | null =>
    index >= 0 && index < rows.length ? rows[index]?.node.value ?? null : null;
  const move = (index: number, extend: boolean): void => {
    const value = valueAt(index);
    if (value !== null) {
      scope.send({ type: "NODE.FOCUS", value });
    }
    if (extend) {
      scope.send({ type: "NODE.ARROW_DOWN" });
    }
  };
  switch (event.key) {
    case "ArrowDown":
      move(at + 1, shift);
      break;
    case "ArrowUp":
      move(at - 1, shift);
      break;
    case "ArrowRight":
      if (branch && !expanded) {
        scope.send({ type: "BRANCH.TOGGLE", value: row.node.value });
        ensureChildren(scope, row.node.value);
      } else if (branch) {
        move(at + 1, false);
      }
      break;
    case "ArrowLeft":
      if (branch && expanded) {
        scope.send({ type: "BRANCH.TOGGLE", value: row.node.value });
      } else if (!branch) {
        const parent = [...rows.slice(0, at)].reverse().find((r) => isBranchRow(r, loadable));
        const parentValue = parent !== undefined ? parent.node.value : null;
        if (parentValue !== null) {
          scope.send({ type: "NODE.FOCUS", value: parentValue });
            }
      }
      break;
    case "Home":
      move(0, shift);
      break;
    case "End":
      move(rows.length - 1, shift);
      break;
    case "Enter":
      scope.send(
        branch && ctx.expandOnClick
          ? { type: "BRANCH_NODE.CLICK", value: row.node.value }
          : { type: "NODE.CLICK", value: row.node.value },
      );
      if (branch && !expanded) ensureChildren(scope, row.node.value);
      break;
    case " ":
      scope.send({ type: "NODE.CLICK", value: row.node.value });
      break;
    case "*":
      scope.send({
        type: "EXPANDED.SET",
        value: rows.filter((r) => isBranchRow(r, loadable)).map((r) => r.node.value),
      });
      break;
    case "F2":
      if (ctx.rename) {
        scope.send({ type: "NODE.RENAME", value: row.node.value });
      }
      break;
    default:
      if (
        scope.props["typeahead"] !== false && event.key.length === 1 && !event.ctrlKey &&
        !event.metaKey
      ) {
        const buffer = typeaheadOf(scope);
        const now = Date.now();
        buffer.keys = now - buffer.at < 500 ? buffer.keys + event.key : event.key;
        buffer.at = now;
        const match = rows.find((r) =>
          r.node.label.toLowerCase().startsWith(buffer.keys.toLowerCase())
        );
        if (match !== undefined) {
          scope.send({ type: "NODE.FOCUS", value: match.node.value });
            }
        return;
      }
      return;
  }
  event.preventDefault();
};

const rowClick = (scope: ScopeLike, row: VisibleRow, event: MouseEvent): void => {
  const ctx = scope.context;
  // Capture BEFORE the send: the send is synchronous, so a post-send check
  // would already see the click's expandedValue and a lazy branch would
  // never load.
  const wasExpanded = ctx.expandedValue.includes(row.node.value);
  const branch = isBranchRow(row, typeof scope.props["loadChildren"] === "function");
  scope.send(
    branch
      ? {
        type: "BRANCH_NODE.CLICK",
        value: row.node.value,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
      }
      : {
        type: "NODE.CLICK",
        value: row.node.value,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
      },
  );
  if (branch && !wasExpanded) ensureChildren(scope, row.node.value);
};

/** The component's public state: the names the markup may key on. */
export const facts = {
  orientation: (scope: ScopeLike) => "vertical",
};

const def: ComponentDef<TreeContext, TreeEvents> = {
  name: "tree",
  machine: (props, authored) => treeViewMachine(props as TreeArgs, authored),
  // Focus follows the machine: every focus move lands the DOM focus on
  // the newly focused row's control.
  settled: ({ before, after, focus }) => {
    if (after.context.focusedValue !== before.context.focusedValue && after.context.focusedValue !== null) {
      focus("item", after.context.focusedValue);
    }
    // The rename input takes focus when it appears; without this the
    // first keystrokes go to the row and Escape cannot cancel.
    if (after.context.renamingValue !== before.context.renamingValue && after.context.renamingValue !== null) {
      focus("rename", after.context.renamingValue);
    }
  },
  parts: {
    root: {
      attrs: (scope) => ({
        id: scope.id(""),
        role: "tree",
        tabindex: -1,
        ...factAttrs(scope, facts, "orientation"),
      }),
    },
    tree: {
      attrs: () => ({ role: "group", "data-orientation": "vertical" }),
    },
    label: {
      attrs: () => ({}),
    },
  },
  slots: {
    item: {
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        const ctx = scope.context;
        return {
          role: "treeitem",
          ...optionRow({
            level: row.depth + 1,
            selected: state.selected,
          }),
          ...disclosureTrigger(scope, {
            expanded: state.branch ? state.expanded : undefined,
          }),
          "data-path": row.indexPath.join("-"),
          // The row carries the mode; the utility on the span selects on it.
          "data-checkable": state.checked || ctx.selectionMode === "multiple" ? "" : undefined,
          ...stateAttrs(state),
        };
      },
    },
    branchControl: {
      id: "item",
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        return {
          id: scope.id("item", row.node.value),
          type: "button",
          tabindex: state.focused ? 0 : -1,
          ...ariaControls(
            scope,
            state.branch ? { part: "content", slot: row.node.value } : undefined,
          ),
          // The control's own box: the row's indent, and the width that
          // goes with it (0.875rem == 14px). The recipe names no var —
          // the bag carries the geometry.
          style: {
            width: `calc(100% - ${row.depth * 14}px)`,
            marginInlineStart: `${row.depth * 0.875}rem`,
          },
          ...stateAttrs(state),
          onClick: (event: MouseEvent): void => rowClick(scope, row, event),
          onDblclick: (): void => {
            if (scope.context.rename) scope.send({ type: "NODE.RENAME", value: row.node.value });
          },
          onKeydown: (event: KeyboardEvent): void => rowKeydown(scope, row, event),
          onFocus: (): void => scope.send({ type: "NODE.FOCUS", value: row.node.value }),
        };
      },
    },
    branchIndicator: {
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        return {
          ...ariaHidden(true),
          // `data-branch`, not `hidden`: the span carries `flex`, and an
          // author `display` beats the UA's `[hidden]` rule.
          "data-branch": state.branch ? "" : undefined,
          ...stateAttrs(state),
        };
      },
    },
    itemIcon: {
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      // One icon bag per kind, not one for the whole tree.
      attrs: (scope: SlotLike<VisibleRow>) => ({
        ...ariaHidden(true),
        "data-kind": iconKind(scope, scope.slot),
      }),
    },
    rail: {
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        return {
          // One column left of this row's own indent — the parent's
          // chevron column. Depth 0 has no parent to draw a rail for.
          ...ariaHidden(true),
          hidden: row.depth === 0,
          // The rail's own box, one column left of the row's indent. The
          // recipe names no var — the bag carries the geometry.
          style: {
            left: `${Math.max(0, row.depth - 1) * 0.875}rem`,
          },
        };
      },
    },
    branchText: {
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      attrs: () => ({}),
    },
    branchContent: {
      id: "content",
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        return {
          id: scope.id("content", row.node.value),
          role: "group",
          hidden: !scope.context.expandedValue.includes(row.node.value),
        };
      },
    },
    checkbox: {
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        const ctx = scope.context;
        return {
          role: "checkbox",
          tabindex: -1,
          ...optionRow({ checked: state.checked }),
          // The checked fact only: the row's own state (expanded, selected)
          // must not reach this element, or every expanded parent rendered
          // as a checked box.
          "data-checked": state.checked ? "" : undefined,
          "data-state": state.checked ? "checked" : "unchecked",
          "data-mode": ctx.selectionMode,
          hidden: ctx.selectionMode !== "multiple",
          onClick: (event: MouseEvent): void => {
            if (event.defaultPrevented) return;
            scope.send({ type: "CHECKED.TOGGLE", value: row.node.value });
                },
        };
      },
    },
    loading: {
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        return {
          hidden: scope.context.loadingStatus[row.node.value] !== "loading",
          ...ariaHidden(true),
        };
      },
    },
    renameInput: {
      id: "rename",
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        return {
          type: "text",
          id: scope.id("rename", row.node.value),
          value: row.node.label,
          hidden: !state.renaming,
          "aria-label": "Rename tree item",
          onKeydown: (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
              scope.send({ type: "RENAME.CANCEL" });
              event.preventDefault();
            } else if (event.key === "Enter") {
              scope.send({
                type: "RENAME.SUBMIT",
                value: row.node.value,
                label: inputValue(event.target),
              });
              event.preventDefault();
            }
            event.stopPropagation();
          },
          onBlur: (event: FocusEvent): void => {
            scope.send({
              type: "RENAME.SUBMIT",
              value: row.node.value,
              label: inputValue(event.target),
            });
          },
        };
      },
    },
  },
  commands: {
    startRenaming: {
      event: (args) => {
        const value = args[0];
        return { type: "NODE.RENAME", value: typeof value === "string" ? value : "" };
      },
    },
  },
  readers: {
    focusedValue: { read: (context) => context.focusedValue },
    expandedValue: { read: (context) => [...context.expandedValue] },
    selectedValue: { read: (context) => [...context.selectedValue] },
    checkedValue: { read: (context) => [...context.checkedValue] },
    renamingValue: { read: (context) => context.renamingValue },
    loadingStatus: { read: (context) => ({ ...context.loadingStatus }) },
    nodes: { read: (_context, _state, props) => nodesOf(props["nodes"]) },
  },
  methods: {
    getVisibleRows: {
      call: (context: TreeContext, _state, _args, props) =>
        rowsOf(nodesOf(props["nodes"]), context.expandedValue),
    },
    isBranch: {
      call: (_context, _state, args, props) =>
        isBranchRow(rowOf(args[0]), typeof props["loadChildren"] === "function"),
    },
    getItemState: {
      call: (context: TreeContext, _state, args, props) => {
        const row = rowOf(args[0]);
        const ctx = context;
        return {
          expanded: ctx.expandedValue.includes(row.node.value),
          selected: ctx.selectedValue.includes(row.node.value),
          focused: ctx.focusedValue === row.node.value,
          checked: ctx.checkedValue.includes(row.node.value),
          loading: ctx.loadingStatus[row.node.value] === "loading",
          branch: isBranchRow(row, typeof props["loadChildren"] === "function"),
          renaming: ctx.renamingValue === row.node.value,
        };
      },
    },
  },
  events: {
    "expanded-change": {
      prop: "onExpandedChange",
      watch: (context) => [...context.expandedValue],
      detail: (watched: readonly unknown[]) => ({ expandedValue: watched.filter((v): v is string => typeof v === "string") }),
    },
    "selection-change": {
      prop: "onSelectionChange",
      watch: (context) => [...context.selectedValue],
      detail: (watched: readonly unknown[]) => ({ selectedValue: watched.filter((v): v is string => typeof v === "string") }),
    },
    "focus-change": {
      prop: "onFocusChange",
      watch: (context) => [context.focusedValue],
      detail: (watched: readonly unknown[]) => {
        const focused = watched[0];
        return { focusedValue: typeof focused === "string" ? focused : null };
      },
    },
    "checked-change": {
      prop: "onCheckedChange",
      watch: (context) => [...context.checkedValue],
      detail: (watched: readonly unknown[]) => ({ checkedValue: watched.filter((v): v is string => typeof v === "string") }),
    },
    "load-complete": {
      prop: "onLoadComplete",
      // Never fired: the machine owns the loading marker, and no send
      // produces a load-complete of its own.
      watch: () => [],
      detail: () => ({ value: "" }),
    },
  },
};

export const treeView = defineComponent<TreeContext, TreeEvents, TreeApi>(def);
