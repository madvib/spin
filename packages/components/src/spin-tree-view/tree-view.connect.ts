/**
 * Tree-view connect: the view layer that keeps the machine pure.
 *
 * Two jobs live here, both deliberately NOT in the machine:
 *
 * 1. **Flattening.** Zag ships a 19kB `TreeCollection` class so its machine
 *    can ask "what is visible". Here it is a 15-line function over the raw
 *    tree plus `expandedValue` — the reactive core substitutes for the
 *    class, and the visible-row list is exactly what the template iterates.
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

export interface TreeConnectProps {
  readonly selectionMode: "single" | "multiple";
  readonly expandOnClick: boolean;
  readonly typeahead: boolean;
  readonly rename: boolean;
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

/** The service surface connect consumes: live context, send. */
interface TreeService {
  readonly context: {
    expandedValue: string[];
    selectedValue: string[];
    checkedValue: string[];
    focusedValue: string | null;
    renamingValue: string | null;
    loadingStatus: Record<string, "loading" | "loaded" | "error">;
    selectionMode: "single" | "multiple";
    expandOnClick: boolean;
    rename: boolean;
  };
  send(event: { type: string } & Record<string, unknown>): void;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

/** Host hook for lazy branches: set as a property on the element. */
type LoadChildren = (
  value: string,
) => Promise<readonly TreeNode[]> | readonly TreeNode[] | void;

export function connectRobotTreeView(
  service: TreeService,
  props: TreeConnectProps,
  getNodes: () => readonly TreeNode[],
  writeNodes: (nodes: readonly TreeNode[]) => void,
  id: string,
  send: Send,
  hostProps: () => Record<string, unknown>,
): TreeApi {
  const ownerId = `tree:${id}`;
  const itemPrefix = `${ownerId}:item:`;
  const itemId = (value: string): string => `${itemPrefix}${value}`;
  const renameInputId = (value: string): string => `${ownerId}:rename:${value}`;
  const ctx = (): TreeService["context"] => service.context;

  /** Flatten the tree to visible rows — the TreeCollection replacement. */
  const flatten = (): readonly VisibleRow[] => {
    const rows: VisibleRow[] = [];
    const walk = (
      list: readonly TreeNode[],
      depth: number,
      indexPath: number[],
    ): void => {
      for (let i = 0; i < list.length; i++) {
        const node = list[i]!;
        const path = [...indexPath, i];
        rows.push({ node, depth, indexPath: path });
        const kids = node.children;
        if (
          kids && kids.length > 0 && ctx().expandedValue.includes(node.value)
        ) walk(kids, depth + 1, path);
      }
    };
    walk(getNodes(), 0, []);
    return rows;
  };

  const valueAt = (rows: readonly VisibleRow[], index: number): string | null =>
    index >= 0 && index < rows.length ? rows[index]!.node.value : null;

  const focusDom = (value: string | null): void => {
    if (value === null) return;
    document.getElementById(itemId(value))?.focus();
  };

  // Branch convention: `children: []` is a leaf; the key's ABSENCE is a
  // loadable branch. Lazy nodes declare no children at all, so a missing
  // key is what distinguishes "loads later" from "has none".
  const isBranch = (row: VisibleRow): boolean => {
    const children = row.node.children;
    if (children === undefined) return loadChildrenHost !== undefined;
    return children.length > 0;
  };

  const getItemState = (row: VisibleRow): TreeItemState => {
    const c = ctx();
    return {
      expanded: c.expandedValue.includes(row.node.value),
      selected: c.selectedValue.includes(row.node.value),
      focused: c.focusedValue === row.node.value,
      checked: c.checkedValue.includes(row.node.value),
      loading: c.loadingStatus[row.node.value] === "loading",
      branch: isBranch(row),
      renaming: c.renamingValue === row.node.value,
    };
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
  /** The host's lazy loader, when one is wired. A missing children key is a
   * lazy branch only when this exists; without it, a leaf is a leaf. */
  const loadChildrenHost = (): LoadChildren | undefined => {
    const load = hostProps()["loadChildren"] as LoadChildren | undefined;
    return typeof load === "function" ? load : undefined;
  };

  const ensureChildren = (value: string): void => {
    const node = flatten().find((row) => row.node.value === value)?.node;
    if (!node || (node.children !== undefined && node.children.length > 0)) {
      return;
    }
    const load = loadChildrenHost();
    if (load === undefined) return;
    send({ type: "NODE.LOAD_START", value });
    void (async () => {
      try {
        const loaded = await load(value);
        if (Array.isArray(loaded)) {
          const current = getNodes();
          const graft = (list: readonly TreeNode[]): TreeNode[] =>
            list.map((item) =>
              item.value === value
                ? { ...item, children: [...(item.children ?? []), ...loaded] }
                : item.children
                ? { ...item, children: graft(item.children) }
                : item
            );
          graftInto(graft(current));
        }
      } catch {
        // A failed load leaves the branch empty; the spinner clears either way.
      } finally {
        send({ type: "NODE.LOAD_DONE", value });
      }
    })();
  };

  /** The grafted tree is written back as a property — host data, host write. */
  const graftInto = (nodes: readonly TreeNode[]): void => {
    writeNodes(nodes);
  };

  /** Typeahead: printable keys accumulate, first visible label match wins. */
  let keys = "";
  let keysAt = 0;

  const keydown = (row: VisibleRow) => (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const rows = flatten();
    const at = rows.findIndex((r) => r.node.value === row.node.value);
    const branch = isBranch(row);
    const expanded = ctx().expandedValue.includes(row.node.value);
    const multiple = ctx().selectionMode === "multiple";
    const shift = event.shiftKey && multiple;
    const move = (index: number, extend: boolean): void => {
      const value = valueAt(rows, index);
      if (value !== null) {
        send({ type: "NODE.FOCUS", value });
        focusDom(value);
      }
      if (extend) {
        send({ type: "NODE.ARROW_DOWN" });
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
          send({ type: "BRANCH.TOGGLE", value: row.node.value });
          ensureChildren(row.node.value);
        } else if (branch) {
          move(at + 1, false);
        }
        break;
      case "ArrowLeft":
        if (branch && expanded) {
          send({ type: "BRANCH.TOGGLE", value: row.node.value });
        } else if (!branch) {
          const parent = [...rows.slice(0, at)].reverse().find((r) =>
            isBranch(r)
          );
          const parentValue = parent ? parent.node.value : null;
          if (parentValue !== null) {
            send({ type: "NODE.FOCUS", value: parentValue });
            focusDom(parentValue);
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
        send(
          branch && ctx().expandOnClick
            ? { type: "BRANCH_NODE.CLICK", value: row.node.value }
            : { type: "NODE.CLICK", value: row.node.value },
        );
        if (branch && !expanded) ensureChildren(row.node.value);
        break;
      case " ":
        send({ type: "NODE.CLICK", value: row.node.value });
        break;
      case "*":
        send({
          type: "EXPANDED.SET",
          value: rows.filter(isBranch).map((r) => r.node.value),
        });
        break;
      case "F2":
        if (ctx().rename) {
          send({ type: "NODE.RENAME", value: row.node.value });
          // The rename input takes focus when it appears; without this the
          // first keystrokes go to the row and Escape cannot cancel.
          document.getElementById(renameInputId(row.node.value))?.focus();
        }
        break;
      default:
        if (
          props.typeahead && event.key.length === 1 && !event.ctrlKey &&
          !event.metaKey
        ) {
          const now = Date.now();
          keys = now - keysAt < 500 ? keys + event.key : event.key;
          keysAt = now;
          const match = rows.find((r) =>
            r.node.label.toLowerCase().startsWith(keys.toLowerCase())
          );
          if (match) {
            send({ type: "NODE.FOCUS", value: match.node.value });
            focusDom(match.node.value);
          }
          return;
        }
        return;
    }
    event.preventDefault();
  };

  const click = (row: VisibleRow) => (event: MouseEvent): void => {
    // Capture BEFORE the send: this send is synchronous, so by the time a
    // post-send check would run, expandedValue already reflects the click
    // and a lazy branch would never load.
    const wasExpanded = ctx().expandedValue.includes(row.node.value);
    const branch = isBranch(row);
    send(
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
    if (branch && !wasExpanded) ensureChildren(row.node.value);
  };

  const dblclick = (row: VisibleRow) => (): void => {
    if (ctx().rename) send({ type: "NODE.RENAME", value: row.node.value });
  };

  return {
    focusedValue: ctx().focusedValue,
    expandedValue: ctx().expandedValue,
    selectedValue: ctx().selectedValue,
    checkedValue: ctx().checkedValue,
    renamingValue: ctx().renamingValue,
    loadingStatus: ctx().loadingStatus,
    nodes: getNodes(),
    getVisibleRows: flatten,
    isBranch,
    getItemState,
    getRootProps: () => ({
      id: ownerId,
      role: "tree",
      tabindex: -1,
      "data-orientation": "vertical",
    }),
    getTreeProps: () => ({ role: "group", "data-orientation": "vertical" }),
    getLabelProps: () => ({}),
    // The row wrapper carries the treeitem semantics: ONE root node per
    // row, so the reconciler's placement never moves a row mid-gesture
    // (a moved node between mousedown and mouseup cancels the click).
    getItemProps: (row) => {
      const state = getItemState(row);
      return {
        role: "treeitem",
        "aria-level": row.depth + 1,
        "aria-selected": state.selected,
        "aria-expanded": state.branch ? state.expanded : undefined,
        "data-path": row.indexPath.join("-"),
        // The checkbox affordance is a mode, so the row carries the mode
        // and the utility on the span selects on it.
        "data-checkable":
          getItemState(row).checked || ctx().selectionMode === "multiple"
            ? ""
            : undefined,
        // Indentation as a custom property: it is continuous geometry, so
        // it travels the geometry channel (the recipe's padding reads the
        // var) rather than as a per-depth utility class. The preset's
        // arbitrary utilities take `var(...)` and refuse `calc()`, so the
        // arithmetic happens here, once, where the depth is known.
        // Indentation and the rail as custom properties: continuous geometry
        // travels the geometry channel, and the arithmetic happens here where
        // the depth is known — the preset's arbitrary utilities take
        // `var(...)` and refuse `calc()`, which is why the indent was flat.
        // The rail sits one column left of this row's indent: the parent's
        // chevron column, where its children's rails belong.
        style: {
          "--tree-indent": `${row.depth * 0.875}rem`,
          "--tree-rail": `${Math.max(0, row.depth - 1) * 0.875}rem`,
          // The row indents by margin, so its width must shrink by the same
          // amount or the fill runs past the card's edge.
          "--tree-w": `calc(100% - ${row.depth * 14}px)`,
        },
        ...stateAttrs(state),
      };
    },
    // The control inside it carries focus, ids and the handlers.
    getBranchControlProps: (row) => {
      const state = getItemState(row);
      return {
        id: itemId(row.node.value),
        type: "button",
        tabindex: state.focused ? 0 : -1,
        "aria-controls": state.branch
          ? `${ownerId}:content:${row.node.value}`
          : undefined,
        ...stateAttrs(state),
        onClick: click(row),
        onDblclick: dblclick(row),
        onKeydown: keydown(row),
        onFocus: () => send({ type: "NODE.FOCUS", value: row.node.value }),
      };
    },
    getBranchIndicatorProps: (row) => ({
      "aria-hidden": true,
      // `data-branch`, not `hidden`: the span carries `flex`, and an
      // author `display` beats the UA's `[hidden]` rule — which is how
      // arrows drew on leaves. A group variant here would compile to a
      // selector lightningcss rejects as a dangling combinator.
      "data-branch": isBranch(row) ? "" : undefined,
      ...stateAttrs(getItemState(row)),
    }),
    getItemIconProps: (row) => {
      const state = getItemState(row);
      const kind = !state.branch ? "leaf" : state.expanded ? "branch-open" : "branch-closed";
      return { "aria-hidden": true, "data-kind": kind };
    },
    getRailProps: (row) => ({
      // One column left of this row's own indent — the parent's chevron
      // column, which is where its children's rails belong. Depth 0 has
      // no parent to draw a rail for.
      "aria-hidden": true,
      hidden: row.depth === 0,
    }),
    getBranchTextProps: () => ({}),
    getBranchContentProps: (row) => ({
      id: `${ownerId}:content:${row.node.value}`,
      role: "group",
      hidden: !ctx().expandedValue.includes(row.node.value),
    }),
    getCheckboxProps: (row) => {
      const state = getItemState(row);
      return {
        role: "checkbox",
        tabindex: -1,
        "aria-checked": state.checked,
        // The checked fact only. The row's own state (expanded, selected)
        // must not reach this element: piped through it, every expanded
        // parent rendered as a checked box.
        "data-checked": state.checked ? "" : undefined,
        "data-state": state.checked ? "checked" : "unchecked",
        // The row's own mode: the box is a mode affordance, so the recipe's
        // utility selects on it (a `hidden` attribute loses to the box's
        // `flex` display, which is how boxes drew in single mode).
        "data-mode": ctx().selectionMode,
        hidden: ctx().selectionMode !== "multiple",
        onClick: (event: MouseEvent) => {
          if (event.defaultPrevented) return;
          send({ type: "CHECKED.TOGGLE", value: row.node.value });
          focusDom(row.node.value);
        },
      };
    },
    getLoadingProps: (row) => ({
      hidden: ctx().loadingStatus[row.node.value] !== "loading",
      "aria-hidden": true,
    }),
    getRenameInputProps: (row) => {
      const state = getItemState(row);
      return {
        type: "text",
        id: renameInputId(row.node.value),
        value: row.node.label,
        hidden: !state.renaming,
        "aria-label": "Rename tree item",
        onKeydown: (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            send({ type: "RENAME.CANCEL" });
            event.preventDefault();
          } else if (event.key === "Enter") {
            send({
              type: "RENAME.SUBMIT",
              value: row.node.value,
              label: (event.target as HTMLInputElement).value,
            });
            event.preventDefault();
          }
          event.stopPropagation();
        },
        onBlur: (event: FocusEvent) => {
          send({
            type: "RENAME.SUBMIT",
            value: row.node.value,
            label: (event.target as HTMLInputElement).value,
          });
        },
      };
    },
    startRenaming: (value: string) => send({ type: "NODE.RENAME", value }),
  };
}
