import {
  dataAttr,
  defineComponent,
  type ComponentDef,
  type PartScope,
  type SlotScope,
} from "@spin/runtime";
import {
  config,
  implementations,
  initial,
  nodesOf,
  type TreeCheckedChange,
  type TreeContext,
  type TreeEvent,
  type TreeExpandedChange,
  type TreeFocusChange,
  type TreeInitial,
  type TreeLoadComplete,
  type TreeNodeShape,
  type TreeSelectionChange,
} from "./tree-view.machine.ts";



/**
 * Tree-view definition: the DOM contract as data. The machine holds
 * focusedValue and the value sets; this file maps props to channels, parts
 * to attribute bags, commands to sends, and expanded/selected/focused/
 * checked transitions to their events.
 *
 * Two jobs live here, both deliberately NOT in the machine:
 *
 * 1. **Flattening.** The visible-row list is a function over the raw tree
 *    plus `expandedValue` — the reactive core substitutes for a collection
 *    class, and the rows are exactly what the template iterates.
 * 2. **Navigation.** Arrows, Home/End, typeahead and shift-range selection
 *    compute their targets against the visible rows and send events. The
 *    machine never walks the tree; it holds focusedValue and nothing else.
 *
 * Rename (F2 / double-click) and lazy loading (a branch expanded with no
 * children calls the host's `loadChildren` property and reports through
 * LOAD_START / LOAD_DONE) also live here: both are view-triggered flows
 * over host-owned data, which is the state/data division applied.
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
  /** Branches show the disclosure indicator; leaves don't. */
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
  /** True when the row opens children — the chevron's visibility. */
  isBranch(row: VisibleRow): boolean;
  getItemState(row: VisibleRow): TreeItemState;
  getRootProps(): Record<string, unknown>;
  getTreeProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getItemProps(row: VisibleRow): Record<string, unknown>;
  getBranchControlProps(row: VisibleRow): Record<string, unknown>;
  getBranchIndicatorProps(row: VisibleRow): Record<string, unknown>;
  /** The row's icon slot: which glyph a branch/leaf wears. */
  getItemIconProps(row: VisibleRow): Record<string, unknown>;
  /** The indent rail: the vertical guide at this row's parent column. */
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

const keysOf = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  if (typeof raw !== "string" || raw.length === 0) return [];
  // A scope default cannot carry top-level commas (the grammar splits
  // props on them), so bracketed-unquoted (`[a, b]`) splits like a bare
  // comma list when JSON fails — string-authored seeds work either way.
  const list = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw;
  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      // Fall through to the comma split below.
    }
  }
  return list.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
};

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v) => b.includes(v));

interface ScopeLike extends PartScope<unknown, TreeContext> {}

interface SlotLike<R> extends SlotScope<R, TreeContext> {}

/** Transport guarantees the raw prop bag is a TreeInitial-shaped object. */
const isTreeInitial = (raw: unknown): raw is TreeInitial =>
  raw !== null && typeof raw === "object";

type IdFn = (part: string, slot?: unknown) => string;

/** Host hook for lazy branches: set as a property on the element. */
type LoadChildren = (
  value: string,
) => Promise<readonly TreeNodeShape[]> | readonly TreeNodeShape[] | void;

const isLoadChildren = (value: unknown): value is LoadChildren =>
  typeof value === "function";

/** Write the grafted tree back onto the host element the way it arrived:
 * JSON text on the `nodes` property. Anything else is not a host. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The rename label off the input target: its value, or empty. */
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

/** Flatten the tree to visible rows — the TreeCollection replacement. */
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
// loadable branch. Lazy nodes declare no children at all, so a missing
// key is what distinguishes "loads later" from "has none".
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

/** Which glyph a row wears: a branch open, a branch closed, or a leaf. */
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
 * machine owns the loading marker. Send LOAD_DONE whatever the host does,
 * so a rejected load clears the spinner rather than sticking.
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
      // A failed load leaves the branch empty; the spinner clears either way.
    } finally {
      scope.send({ type: "NODE.LOAD_DONE", value });
    }
  })();
};

/** Typeahead buffers, keyed per bridge: printable keys accumulate, first
 * visible label match wins. */
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
  // Capture BEFORE the send: this send is synchronous, so by the time a
  // post-send check would run, expandedValue already reflects the click
  // and a lazy branch would never load.
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

const def: ComponentDef<TreeContext, TreeEvent> = {
  name: "tree",
  config,
  implementations,
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
  seed: (raw, authored) => {
    const props: TreeInitial = isTreeInitial(raw) ? raw : {};
    const shaped = initial(props, authored);
    return {
      ...shaped,
      focusedValue: null,
      renamingValue: null,
      loadingStatus: {},
      typeahead: "",
    };
  },
  reconcile: ({ context, parsed, authored, send }) => {
    const sets = [
      ["expandedValue", "EXPANDED.SET"],
      ["selectedValue", "SELECTED.SET"],
      ["checkedValue", "CHECKED.SET"],
    ] as const;
    for (const [name, type] of sets) {
      if (!authored(name)) continue;
      const outer = keysOf(parsed[name]);
      if (!sameSet(context[name], outer)) {
        send({ type, value: [...outer] });
        return true;
      }
    }
    return false;
  },
  scalars: ["selectionMode", "expandOnClick", "rename"],
  parts: {
    root: {
      sig: () => "root",
      attrs: (scope) => ({
        id: scope.id(""),
        role: "tree",
        tabindex: -1,
        "data-orientation": "vertical",
      }),
    },
    tree: {
      sig: () => "tree",
      attrs: () => ({ role: "group", "data-orientation": "vertical" }),
    },
    label: {
      sig: () => "label",
      attrs: () => ({}),
    },
  },
  slots: {
    item: {
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      sig: (scope: SlotLike<VisibleRow>) => {
        const state = itemStateOf(scope, scope.slot);
        return [
          state.expanded,
          state.selected,
          state.focused,
          state.checked,
          state.loading,
          state.renaming,
          (scope.slot).depth,
        ].join(" ");
      },
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        const ctx = scope.context;
        return {
          role: "treeitem",
          "aria-level": row.depth + 1,
          "aria-selected": state.selected,
          "aria-expanded": state.branch ? state.expanded : undefined,
          "data-path": row.indexPath.join("-"),
          // The checkbox affordance is a mode, so the row carries the
          // mode and the utility on the span selects on it.
          "data-checkable": state.checked || ctx.selectionMode === "multiple" ? "" : undefined,
          // Indentation as custom properties: continuous geometry travels
          // the geometry channel, and the arithmetic happens here where
          // the depth is known. The rail sits one column left of this
          // row's indent: the parent's chevron column, where its
          // children's rails belong. The row indents by margin, so its
          // width must shrink by the same amount.
          style: {
            "--tree-indent": `${row.depth * 0.875}rem`,
            "--tree-rail": `${Math.max(0, row.depth - 1) * 0.875}rem`,
            "--tree-w": `calc(100% - ${row.depth * 14}px)`,
          },
          ...stateAttrs(state),
        };
      },
    },
    branchControl: {
      id: "item",
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      sig: (scope: SlotLike<VisibleRow>) => {
        const state = itemStateOf(scope, scope.slot);
        return [state.focused, state.expanded, state.selected].join(" ");
      },
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        return {
          id: scope.id("item", row.node.value),
          type: "button",
          tabindex: state.focused ? 0 : -1,
          "aria-controls": state.branch ? scope.id("content", row.node.value) : undefined,
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
      sig: (scope: SlotLike<VisibleRow>) => {
        const state = itemStateOf(scope, scope.slot);
        return [`${state.branch}`, state.expanded, state.selected].join(" ");
      },
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        return {
          "aria-hidden": true,
          // `data-branch`, not `hidden`: the span carries `flex`, and an
          // author `display` beats the UA's `[hidden]` rule — which is how
          // arrows drew on leaves.
          "data-branch": state.branch ? "" : undefined,
          ...stateAttrs(state),
        };
      },
    },
    itemIcon: {
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      // The glyph is chosen by the row's kind, so the signature carries it:
      // one icon bag per kind, not one for the whole tree.
      sig: (scope: SlotLike<VisibleRow>) => iconKind(scope, scope.slot),
      attrs: (scope: SlotLike<VisibleRow>) => ({
        "aria-hidden": true,
        "data-kind": iconKind(scope, scope.slot),
      }),
    },
    rail: {
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      sig: (scope: SlotLike<VisibleRow>) => `${scope.slot.depth}`,
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        return {
          // One column left of this row's own indent — the parent's
          // chevron column. Depth 0 has no parent to draw a rail for.
          "aria-hidden": true,
          hidden: row.depth === 0,
        };
      },
    },
    branchText: {
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      sig: () => "text",
      attrs: () => ({}),
    },
    branchContent: {
      id: "content",
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      sig: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        return `${scope.context.expandedValue.includes(row.node.value)}`;
      },
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
      sig: (scope: SlotLike<VisibleRow>) => {
        const state = itemStateOf(scope, scope.slot);
        return [state.checked, scope.context.selectionMode].join(" ");
      },
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        const state = itemStateOf(scope, row);
        const ctx = scope.context;
        return {
          role: "checkbox",
          tabindex: -1,
          "aria-checked": state.checked,
          // The checked fact only. The row's own state (expanded,
          // selected) must not reach this element: piped through it, every
          // expanded parent rendered as a checked box.
          "data-checked": state.checked ? "" : undefined,
          "data-state": state.checked ? "checked" : "unchecked",
          // The row's own mode: the box is a mode affordance, so the
          // recipe's utility selects on it.
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
      sig: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        return `${scope.context.loadingStatus[row.node.value] === "loading"}`;
      },
      attrs: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        return {
          hidden: scope.context.loadingStatus[row.node.value] !== "loading",
          "aria-hidden": true,
        };
      },
    },
    renameInput: {
      id: "rename",
      indexes: (context: TreeContext, props: Record<string, unknown>) => rowsOf(nodesOf(props["nodes"]), context.expandedValue),
      sig: (scope: SlotLike<VisibleRow>) => {
        const row = scope.slot;
        return `${scope.context.renamingValue === row.node.value}`;
      },
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
      // The bridge never fired this either: the machine owns the loading
      // marker, and no send produces a load-complete of its own.
      watch: () => [],
      detail: () => ({ value: "" }),
    },
  },
};

export const treeView = defineComponent<TreeContext, TreeEvent, TreeApi>(def);
