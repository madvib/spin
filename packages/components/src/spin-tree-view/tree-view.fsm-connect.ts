/**
 * Tree-view connect: the view layer that keeps the machine pure.
 *
 * Two jobs live here, both deliberately NOT in the machine:
 *
 * 1. **Flattening.** Zag ships a 19kB `TreeCollection` class so its machine
 *    can ask "what is visible". Here it is a 15-line function over the raw
 *    tree plus `expandedValue` — the reactive core substitutes for the
 *    class, and the visible-row list is exactly what the template iterates.
 * 2. **Navigation.** Arrows, Home/End, and typeahead compute the next view
 *    target and send `NODE.FOCUS`. The machine never walks the tree; it only
 *    holds `focusedValue`. That is the whole split: the machine owns state,
 *    the view owns where things are.
 *
 * Selection semantics (ctrl/shift in multiple mode, expandOnClick, checking)
 * stay in the machine's guards and assigns, where they are testable as data.
 * The DOM carries semantics (role/aria/ids) plus the state attributes the
 * utility engine targets — no part-identity attributes.
 */

export interface TreeNode {
  readonly value: string;
  readonly label: string;
  readonly children?: readonly TreeNode[] | undefined;
}

export interface TreeFsmConnectProps {
  readonly selectionMode: "single" | "multiple";
  readonly expandOnClick: boolean;
  readonly typeahead: boolean;
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
}

export interface TreeFsmApi {
  readonly focusedValue: string | null;
  readonly expandedValue: string[];
  readonly selectedValue: string[];
  readonly checkedValue: string[];
  readonly renamingValue: string | null;
  readonly loadingStatus: Record<string, "loading" | "loaded" | "error">;
  getVisibleRows(): readonly VisibleRow[];
  getItemState(row: VisibleRow): TreeItemState;
  getRootProps(): Record<string, unknown>;
  getTreeProps(): Record<string, unknown>;
  getLabelProps(): Record<string, unknown>;
  getBranchProps(row: VisibleRow): Record<string, unknown>;
  getBranchControlProps(row: VisibleRow): Record<string, unknown>;
  getBranchIndicatorProps(row: VisibleRow): Record<string, unknown>;
  getBranchTextProps(row: VisibleRow): Record<string, unknown>;
  getBranchContentProps(row: VisibleRow): Record<string, unknown>;
  getItemProps(row: VisibleRow): Record<string, unknown>;
  getItemTextProps(row: VisibleRow): Record<string, unknown>;
  getItemIndicatorProps(row: VisibleRow): Record<string, unknown>;
  getRenameInputProps(row: VisibleRow): Record<string, unknown>;
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
  };
  send(event: { type: string } & Record<string, unknown>): void;
}

type Send = (event: { type: string } & Record<string, unknown>) => void;

export function connectRobotTreeView(
  service: TreeService,
  props: TreeFsmConnectProps,
  getNodes: () => readonly TreeNode[],
  id: string,
  send: Send,
): TreeFsmApi {
  const ownerId = `tree:${id}`;
  const itemPrefix = `${ownerId}:item:`;
  const itemId = (value: string): string => `${itemPrefix}${value}`;

  const ctx = (): TreeService["context"] => service.context;

  /** Flatten the tree to visible rows — the TreeCollection replacement. */
  const flatten = (): readonly VisibleRow[] => {
    const rows: VisibleRow[] = [];
    const walk = (list: readonly TreeNode[], depth: number, indexPath: number[]): void => {
      for (let i = 0; i < list.length; i++) {
        const node = list[i]!;
        const path = [...indexPath, i];
        rows.push({ node, depth, indexPath: path });
        const kids = node.children;
        if (kids && kids.length > 0 && ctx().expandedValue.includes(node.value)) walk(kids, depth + 1, path);
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

  const isBranch = (row: VisibleRow): boolean =>
    row.node.children !== undefined && row.node.children.length > 0;

  const getItemState = (row: VisibleRow): TreeItemState => {
    const c = ctx();
    return {
      expanded: c.expandedValue.includes(row.node.value),
      selected: c.selectedValue.includes(row.node.value),
      focused: c.focusedValue === row.node.value,
      checked: c.checkedValue.includes(row.node.value),
      loading: c.loadingStatus[row.node.value] === "loading",
      branch: isBranch(row),
    };
  };

  const stateAttrs = (state: TreeItemState): Record<string, unknown> => {
    const attrs: Record<string, unknown> = { "data-state": state.expanded ? "open" : "closed" };
    if (state.branch) attrs["data-branch"] = "";
    if (state.selected) attrs["data-selected"] = "";
    if (state.focused) attrs["data-focus"] = "";
    if (state.checked) attrs["data-checked"] = "";
    if (state.loading) attrs["data-loading"] = "";
    return attrs;
  };

  /** Depth indentation through the utility channel — a class chosen by
   * state, never a style attribute. */
  const depthClass = (depth: number): string => `ml-${(depth * 4).toString()}`;

  /** Typeahead: printable keys accumulate, first visible label match wins. */
  let keys = "";
  let keysAt = 0;

  const keydown = (row: VisibleRow) => (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const rows = flatten();
    const at = rows.findIndex((r) => r.node.value === row.node.value);
    const branch = isBranch(row);
    const expanded = ctx().expandedValue.includes(row.node.value);
    const move = (index: number): void => {
      const value = valueAt(rows, index);
      if (value !== null) {
        send({ type: "NODE.FOCUS", value });
        focusDom(value);
      }
    };
    switch (event.key) {
      case "ArrowDown":
        move(at + 1);
        break;
      case "ArrowUp":
        move(at - 1);
        break;
      case "ArrowRight":
        if (branch && !expanded) send({ type: "BRANCH.TOGGLE", value: row.node.value });
        else if (branch) move(at + 1);
        else break;
        break;
      case "ArrowLeft":
        if (branch && expanded) {
          send({ type: "BRANCH.TOGGLE", value: row.node.value });
        } else if (!branch) {
          const parent = [...rows.slice(0, at)].reverse().find((r) => isBranch(r));
          if (parent) move(rows.findIndex((r) => r.node.value === parent.node.value));
        } else break;
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(rows.length - 1);
        break;
      case "Enter":
      case " ":
        send(branch
          ? { type: "BRANCH_NODE.CLICK", value: row.node.value }
          : { type: "NODE.CLICK", value: row.node.value });
        break;
      case "*":
        send({ type: "EXPANDED.SET", value: rows.filter(isBranch).map((r) => r.node.value) });
        break;
      default:
        if (props.typeahead && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          const now = Date.now();
          keys = now - keysAt < 500 ? keys + event.key : event.key;
          keysAt = now;
          const match = rows.find((r) => r.node.label.toLowerCase().startsWith(keys.toLowerCase()));
          if (match) {
            send({ type: "NODE.FOCUS", value: match.node.value });
            focusDom(match.node.value);
          }
        }
        return;
    }
    event.preventDefault();
  };

  const click = (row: VisibleRow) => (event: MouseEvent): void => {
    send(isBranch(row)
      ? { type: "BRANCH_NODE.CLICK", value: row.node.value, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey }
      : { type: "NODE.CLICK", value: row.node.value, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey });
  };

  return {
    focusedValue: ctx().focusedValue,
    expandedValue: ctx().expandedValue,
    selectedValue: ctx().selectedValue,
    checkedValue: ctx().checkedValue,
    renamingValue: ctx().renamingValue,
    loadingStatus: ctx().loadingStatus,
    getVisibleRows: flatten,
    getItemState,
    getRootProps: () => ({
      id: ownerId,
      role: "tree",
      tabindex: -1,
      "data-orientation": "vertical",
    }),
    getTreeProps: () => ({ role: "group", "data-orientation": "vertical" }),
    getLabelProps: () => ({}),
    getBranchProps: (row) => {
      const state = getItemState(row);
      return {
        role: "treeitem",
        "aria-expanded": state.expanded,
        "aria-level": row.depth + 1,
        "data-path": row.indexPath.join("-"),
        ...stateAttrs(state),
      };
    },
    getBranchControlProps: (row) => {
      const state = getItemState(row);
      return {
        class: depthClass(row.depth),
        id: itemId(row.node.value),
        type: "button",
        tabindex: state.focused ? 0 : -1,
        "aria-controls": `${ownerId}:content:${row.node.value}`,
        ...stateAttrs(state),
        onClick: click(row),
        onKeydown: keydown(row),
        onFocus: () => send({ type: "NODE.FOCUS", value: row.node.value }),
      };
    },
    getBranchIndicatorProps: (row) => ({ "aria-hidden": true, ...stateAttrs(getItemState(row)) }),
    getBranchTextProps: () => ({}),
    getBranchContentProps: (row) => ({
      id: `${ownerId}:content:${row.node.value}`,
      role: "group",
      hidden: !ctx().expandedValue.includes(row.node.value),
    }),
    getItemProps: (row) => {
      const state = getItemState(row);
      return {
        role: "treeitem",
        "aria-level": row.depth + 1,
        "aria-selected": state.selected,
        "data-path": row.indexPath.join("-"),
        id: itemId(row.node.value),
        type: "button",
        tabindex: state.focused ? 0 : -1,
        "aria-controls": isBranch(row) ? `${ownerId}:content:${row.node.value}` : undefined,
        ...stateAttrs(state),
        onClick: click(row),
        onKeydown: keydown(row),
        onFocus: () => send({ type: "NODE.FOCUS", value: row.node.value }),
      };
    },
    getItemTextProps: () => ({}),
    getItemIndicatorProps: () => ({ "aria-hidden": true }),
    getRenameInputProps: (row) => ({
      value: row.node.label,
      onBlur: (event: FocusEvent) => {
        send({ type: "RENAME.SUBMIT", value: row.node.value, label: (event.target as HTMLInputElement).value });
      },
      onKeydown: (event: KeyboardEvent) => {
        if (event.key === "Enter") {
          send({ type: "RENAME.SUBMIT", value: row.node.value, label: (event.target as HTMLInputElement).value });
          event.preventDefault();
        } else if (event.key === "Escape") {
          send({ type: "RENAME.CANCEL" });
          event.preventDefault();
        }
      },
    }),
  };
}
