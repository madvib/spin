import {
  defineComponent,
  textProp,
  type ComponentDef,
  type PartScope as ScopeLike,
} from "@spin/runtime";
import {
  config,
  implementations,
  type MenuContext,
  type MenuEvent,
} from "./menu.machine.ts";

/**
 * Menu definition: the DOM contract as data. The machine owns open/closed,
 * the highlight, the anchor point and the open submenu on this level; this
 * file maps props to channels, parts to attribute bags, commands to sends,
 * and select/highlight/open transitions to their events. Navigation (move,
 * edge, typeahead) computes its target against the rows the view holds and
 * sends it in — the machine never walks data. The collection parses once
 * per prop identity: row and block objects are stable, so the `for`
 * bindings never re-stamp.
 *
 * A submenu level is its own bridge instance; levels meet through the
 * element tree. A parent writes the child instance's `open` attribute —
 * the controlled channel, exactly the path a host's own write takes — and
 * the child reports a close back up as a bubbling `submenuclose` event so
 * the parent clears the `openSubmenu` context that drove it.
 */

export interface MenuItemData {
  readonly value: string;
  readonly label: string;
  readonly shortcut?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly checked?: boolean | undefined;
  readonly children?: readonly MenuEntry[] | undefined;
}

export interface MenuSeparatorData {
  readonly separator: true;
}

export interface MenuGroupData {
  readonly group: string;
  readonly items: readonly MenuEntry[];
}

export type MenuEntry = MenuItemData | MenuSeparatorData | MenuGroupData;

export interface MenuRow {
  readonly value: string;
  readonly label: string;
  readonly shortcut: string;
  readonly disabled: boolean;
  /** Undefined for a plain item; a defined value makes it a checkable item. */
  readonly checked: boolean | undefined;
  readonly children: readonly MenuEntry[];
}

export interface MenuBlock {
  readonly id: string;
  readonly label: string | null;
  readonly rows: readonly MenuRow[];
  /** A hairline separator renders after this block. */
  readonly separator: boolean;
}

export interface MenuOpenChange {
  readonly open: boolean;
}

export interface MenuSelect {
  readonly value: string;
}

export interface MenuHighlightChange {
  readonly highlightedValue: string | null;
}

export interface MenuApi {
  readonly isOpen: boolean;
  readonly highlightedValue: string | null;
  open(): void;
  close(): void;
  setHighlighted(value: string | null): void;
  getBlocks(): readonly MenuBlock[];
  getRows(block: MenuBlock): readonly MenuRow[];
  getTriggerProps(): Record<string, unknown>;
  getTriggerIndicatorProps(): Record<string, unknown>;
  getContextTriggerProps(): Record<string, unknown>;
  getPositionerProps(): Record<string, unknown>;
  getContentProps(): Record<string, unknown>;
  getItemGroupProps(block: MenuBlock): Record<string, unknown>;
  getItemGroupLabelProps(block: MenuBlock): Record<string, unknown>;
  getItemProps(row: MenuRow): Record<string, unknown>;
  getItemTextProps(row: MenuRow): Record<string, unknown>;
  getItemIndicatorProps(row: MenuRow): Record<string, unknown>;
  getItemShortcutProps(row: MenuRow): Record<string, unknown>;
  getItemSubmenuIndicatorProps(row: MenuRow): Record<string, unknown>;
  getSeparatorProps(block: MenuBlock): Record<string, unknown>;
  /** The bag the parent level spreads onto this instance's element. */
  getSubmenuProps(row: MenuRow): Record<string, unknown>;
}

/** JSON transport for the item tree (the grammar has no recursive type), so
 * the shape is validated here rather than trusted at every read. Malformed
 * entries drop out instead of poisoning the row list. */
const parseEntry = (raw: unknown): MenuEntry | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined;
  const separator = Reflect.get(raw, "separator");
  if (separator === true) return { separator: true };
  const group = Reflect.get(raw, "group");
  const items = Reflect.get(raw, "items");
  if (typeof group === "string" && Array.isArray(items)) {
    return {
      group,
      items: items.flatMap((item) => {
        const entry = parseEntry(item);
        return entry === undefined ? [] : [entry];
      }),
    };
  }
  const value = Reflect.get(raw, "value");
  const label = Reflect.get(raw, "label");
  if (typeof value !== "string" || typeof label !== "string") return undefined;
  const row: {
    value: string;
    label: string;
    shortcut?: string;
    disabled?: boolean;
    checked?: boolean;
    children?: readonly MenuEntry[];
  } = { value, label };
  const shortcut = Reflect.get(raw, "shortcut");
  if (typeof shortcut === "string") row.shortcut = shortcut;
  const disabled = Reflect.get(raw, "disabled");
  if (typeof disabled === "boolean") row.disabled = disabled;
  const checked = Reflect.get(raw, "checked");
  if (typeof checked === "boolean") row.checked = checked;
  const children = Reflect.get(raw, "children");
  if (Array.isArray(children)) {
    row.children = children.flatMap((child) => {
      const entry = parseEntry(child);
      return entry === undefined ? [] : [entry];
    });
  }
  return row;
};

const parseItems = (raw: unknown): readonly MenuEntry[] => {
  if (Array.isArray(raw)) {
    // A host holding the live object stops at the scope boundary: arrays
    // arrive raw, already shaped, so only the malformed drop out.
    const live = (raw as readonly unknown[]).every((item) => typeof item === "object" && item !== null);
    if (live) {
      return (raw as readonly unknown[]).flatMap((item) => {
        const entry = parseEntry(item);
        return entry === undefined ? [] : [entry];
      });
    }
    return [];
  }
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return (parsed as readonly unknown[]).flatMap((item) => {
        const entry = parseEntry(item);
        return entry === undefined ? [] : [entry];
      });
    }
  } catch {
    return [];
  }
  return [];
};

type Ctx = MenuContext;

const asCtx = (context: Record<string, unknown>): Ctx => context as unknown as Ctx;

const entriesOf = (parsed: Record<string, unknown>): readonly MenuEntry[] =>
  parsed["items"] as readonly MenuEntry[];

const toRow = (entry: MenuEntry): MenuRow | undefined => {
  if (!("value" in entry)) return undefined;
  const checked = entry.checked;
  return {
    value: entry.value,
    label: entry.label,
    shortcut: entry.shortcut ?? "",
    disabled: entry.disabled === true,
    checked: checked === undefined ? undefined : checked === true,
    children: entry.children ?? [],
  };
};

/** Blocks memoized on the entries' identity: the `for` directive iterates
 * this array, and fresh wrappers per read would re-stamp the groups. */
const blocksCache = new WeakMap<readonly MenuEntry[], readonly MenuBlock[]>();
const blocksOf = (entries: readonly MenuEntry[]): readonly MenuBlock[] => {
  const hit = blocksCache.get(entries);
  if (hit !== undefined) return hit;
  const built: MenuBlock[] = [];
  let label: string | null = null;
  let rows: MenuRow[] = [];
  const flush = (): void => {
    if (rows.length > 0) {
      // The owner prefix lands in `attrs` (indexes has no scope): the
      // block carries its group index, and the part id namespaces it.
      built.push({ id: `group:${built.length}`, label, rows, separator: false });
      rows = [];
    }
    label = null;
  };
  for (const entry of entries) {
    if ("separator" in entry) {
      flush();
      // The hairline belongs to the block above it, not the one below.
      const last = built[built.length - 1];
      if (last !== undefined) built[built.length - 1] = { ...last, separator: true };
      continue;
    }
    if ("group" in entry) {
      flush();
      label = entry.group;
      for (const item of entry.items) {
        const row = toRow(item);
        if (row !== undefined) rows.push(row);
      }
      flush();
      continue;
    }
    const row = toRow(entry);
    if (row !== undefined) rows.push(row);
  }
  flush();
  blocksCache.set(entries, built);
  return built;
};

const rowsOf = (entries: readonly MenuEntry[]): readonly MenuRow[] => {
  const rows: MenuRow[] = [];
  for (const entry of entries) {
    if ("value" in entry) {
      const row = toRow(entry);
      if (row !== undefined) rows.push(row);
    } else if ("group" in entry) {
      for (const item of entry.items) {
        const row = toRow(item);
        if (row !== undefined) rows.push(row);
      }
    }
  }
  return rows;
};

const navigableOf = (rows: readonly MenuRow[]): readonly MenuRow[] =>
  rows.filter((row) => !row.disabled);

/** Typeahead state, keyed by bridge send: the connect is long-lived, but a
 * def-built api may rebuild it per tick, and a fresh buffer would erase the
 * sequence. */
const typeaheadByBridge = new WeakMap<
  (event: { type: string } & Record<string, unknown>) => void,
  { keys: string; at: number }
>();
const typeaheadOf = (
  scope: ScopeLike,
): { keys: string; at: number } => {
  let state = typeaheadByBridge.get(scope.send);
  if (state === undefined) {
    state = { keys: "", at: 0 };
    typeaheadByBridge.set(scope.send, state);
  }
  return state;
};

/** Row handlers, built once per row per bridge: the scope reads live
 * through proxies, so a cached closure never goes stale. */
type RowHandlerSet = {
  readonly onPointerMove: (event: PointerEvent) => void;
  readonly onClick: (event: MouseEvent) => void;
};
const rowHandlersByBridge = new WeakMap<
  (event: { type: string } & Record<string, unknown>) => void,
  WeakMap<MenuRow, RowHandlerSet>
>();
const rowHandlers = (scope: ScopeLike, row: MenuRow): RowHandlerSet => {
  let byRow = rowHandlersByBridge.get(scope.send);
  if (byRow === undefined) {
    byRow = new WeakMap();
    rowHandlersByBridge.set(scope.send, byRow);
  }
  const hit = byRow.get(row);
  if (hit !== undefined) return hit;
  const made: RowHandlerSet = {
    onPointerMove: (event: PointerEvent): void => {
      if (event.pointerType !== "mouse" || row.disabled) return;
      scope.send({ type: "HIGHLIGHT", value: row.value });
    },
    onClick: (event: MouseEvent): void => {
      activate(scope, row, event.currentTarget instanceof Element ? event.currentTarget : null);
    },
  };
  byRow.set(row, made);
  return made;
};

const highlight = (scope: ScopeLike, value: string | null): void => {
  scope.send({ type: "HIGHLIGHT", value });
};

const focusId = (id: string): void => {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.focus();
};

const move = (scope: ScopeLike, delta: number): void => {
  const list = navigableOf(rowsOf(entriesOf(scope.props)));
  if (list.length === 0) return;
  const at = list.findIndex((row) => row.value === asCtx(scope.context).highlightedValue);
  let target: MenuRow | undefined;
  if (at === -1) target = delta > 0 ? list[0] : list[list.length - 1];
  else if (scope.props["loopFocus"] === true) target = list[(at + delta + list.length) % list.length];
  else target = list[Math.min(Math.max(at + delta, 0), list.length - 1)];
  if (target !== undefined) highlight(scope, target.value);
};

const edge = (scope: ScopeLike, from: "first" | "last"): void => {
  const list = navigableOf(rowsOf(entriesOf(scope.props)));
  const row = from === "first" ? list[0] : list[list.length - 1];
  if (row !== undefined) highlight(scope, row.value);
};

/** Enter this level's submenu: the machine opens it on this level's
 * context, and focus follows to the child's content so the keyboard stays
 * in one chain of levels. */
const openSubmenu = (scope: ScopeLike, value: string): void => {
  scope.send({ type: "SUBMENU_OPEN", value });
  focusId(`${scope.id("submenu", value)}:content`);
};

const closeSelf = (scope: ScopeLike): void => {
  scope.send({ type: "CLOSE" });
};

/** Tell the level above that this one closed, so it clears the context
 * that opened it. A select means the whole chain closes. */
const reportClose = (scope: ScopeLike, select: boolean): void => {
  scope.root().dispatchEvent(new CustomEvent("submenuclose", { bubbles: true, detail: { select } }));
};

const typeaheadMatch = (scope: ScopeLike, key: string): void => {
  const buffer = typeaheadOf(scope);
  const now = Date.now();
  buffer.keys = now - buffer.at < 500 ? buffer.keys + key : key;
  buffer.at = now;
  const needle = buffer.keys.toLowerCase();
  const match = rowsOf(entriesOf(scope.props)).find(
    (row) => !row.disabled && row.label.toLowerCase().startsWith(needle),
  );
  if (match !== undefined) highlight(scope, match.value);
};

const isPrintable = (event: KeyboardEvent): boolean =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

const activate = (scope: ScopeLike, row: MenuRow, node: Element | null): void => {
  if (row.disabled) return;
  if (row.children.length > 0) {
    openSubmenu(scope, row.value);
    return;
  }
  if (node instanceof Element) {
    const href = node.getAttribute("href");
    const navigate = scope.props["navigate"];
    if (href !== null && typeof navigate === "function") {
      (navigate as (details: { value: string; node: Element; href: string }) => void)({
        value: row.value,
        node,
        href,
      });
    }
  }
  scope.send({ type: "ITEM_CLICK", value: row.value });
  if (scope.props["closeOnSelect"] !== false) {
    closeSelf(scope);
    reportClose(scope, true);
  }
};

const rowByValue = (scope: ScopeLike, value: string | null): MenuRow | undefined =>
  value === null
    ? undefined
    : rowsOf(entriesOf(scope.props)).find((row) => row.value === value);

const onContentKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  const current = asCtx(scope.context).highlightedValue;
  switch (event.key) {
    case "ArrowDown":
      move(scope, 1);
      break;
    case "ArrowUp":
      move(scope, -1);
      break;
    case "Home":
      edge(scope, "first");
      break;
    case "End":
      edge(scope, "last");
      break;
    case "ArrowRight": {
      const row = rowByValue(scope, current);
      if (row !== undefined && row.children.length > 0) openSubmenu(scope, row.value);
      break;
    }
    case "ArrowLeft": {
      if (scope.props["submenu"] !== true) break;
      closeSelf(scope);
      reportClose(scope, false);
      focusParent(scope);
      break;
    }
    case "Enter": {
      const row = rowByValue(scope, current);
      if (row !== undefined) {
        activate(
          scope,
          row,
          typeof document === "undefined"
            ? null
            : document.getElementById(scope.id("item", row.value)),
        );
      }
      break;
    }
    case " ": {
      if (typeaheadOf(scope).keys.length > 0) {
        typeaheadMatch(scope, event.key);
        break;
      }
      const row = rowByValue(scope, current);
      if (row !== undefined) {
        activate(
          scope,
          row,
          typeof document === "undefined"
            ? null
            : document.getElementById(scope.id("item", row.value)),
        );
      }
      break;
    }
    default:
      if (scope.props["typeahead"] !== false && isPrintable(event)) typeaheadMatch(scope, event.key);
      else return;
      break;
  }
  event.preventDefault();
};

const onTriggerKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  const open = scope.state === "open";
  const openItem = (from: "first" | "last"): void => {
    scope.send({ type: "TRIGGER_CLICK" });
    edge(scope, from);
    focusId(scope.id("content"));
  };
  switch (event.key) {
    case "ArrowDown":
    case "Enter":
      if (open) move(scope, 1);
      else openItem("first");
      break;
    case "ArrowUp":
      if (open) move(scope, -1);
      else openItem("last");
      break;
    case " ":
      if (open) move(scope, 1);
      else openItem("first");
      break;
    case "Escape":
      if (open) closeSelf(scope);
      break;
    default:
      return;
  }
  event.preventDefault();
};

/** A press on this level's own trigger is that gesture's business, not a
 * dismissal: without it the open press and the trigger's toggle fight. */
const isTriggerTarget = (scope: ScopeLike, target: EventTarget | null): boolean => {
  if (!(target instanceof Element) || typeof document === "undefined") return false;
  const trigger = scope.props["submenu"] === true
    ? scope.root().parentElement
    : document.getElementById(scope.id("trigger"));
  return trigger !== null && trigger !== undefined && trigger.contains(target);
};

const onSubmenuClose = (scope: ScopeLike, event: Event): void => {
  if (!("detail" in event)) return;
  const detail: unknown = event.detail;
  const select = typeof detail === "object" && detail !== null && Reflect.get(detail, "select") === true;
  if (select) {
    if (scope.props["closeOnSelect"] !== false) closeSelf(scope);
    return;
  }
  const target = event.target;
  const openValue = asCtx(scope.context).openSubmenu;
  if (openValue === null || !(target instanceof Element)) return;
  if (target.id !== scope.id("submenu", openValue)) return;
  scope.send({ type: "SUBMENU_CLOSE" });
};

/** A submenu hands focus back to the level that holds its trigger row. */
const focusParent = (scope: ScopeLike): void => {
  const parent = scope.root().closest('[role="menu"]');
  if (parent instanceof HTMLElement) parent.focus();
};

/**
 * Anchor geometry as custom properties; the recipe's bracketed utilities
 * decide what each one feeds. A trigger-driven menu reports the trigger's
 * rect, a context menu reports the point relative to the positioning host.
 */
const geometryStyle = (scope: ScopeLike): Record<string, string> => {
  if (typeof document === "undefined") return {};
  const anchor = asCtx(scope.context).anchorPoint;
  if (anchor !== null) {
    const host = document.getElementById(scope.id("positioner"))?.offsetParent;
    if (host instanceof Element) {
      const rect = host.getBoundingClientRect();
      return {
        "--menu-anchor-x": `${anchor.x - rect.left}px`,
        "--menu-anchor-y": `${anchor.y - rect.top}px`,
        "--menu-anchor-w": `${rect.width}px`,
      };
    }
  }
  const above = scope.props["placement"] === "top-start" ? "calc(-100% - 8px)" : "calc(100% + 8px)";
  const rect = document.getElementById(scope.id("trigger"))?.getBoundingClientRect();
  const width = rect === undefined ? 0 : rect.width;
  return { "--menu-anchor-y": above, "--menu-anchor-w": `${width}px` };
};

const def: ComponentDef<MenuContext, MenuEvent> = {
  name: "menu",
  config,
  implementations,
  start: (props, authored) => {
    if (authored("open")) return (props["open"] as boolean) === true ? "open" : "closed";
    return (props["defaultOpen"] as boolean) === true ? "open" : "closed";
  },
  seed: (props) => ({
    isSubmenu: (props["submenu"] as boolean) === true,
  }),
  channels: {
    items: { parse: parseItems },
    defaultOpen: { parse: (raw) => raw === true },
    open: {
      controlled: true,
      parse: (raw) => {
        if (typeof raw !== "string") return raw === true;
        // A submenu level's parent writes the child's `open` attribute, so
        // the attribute text is the channel: "true" (or the bare attribute)
        // opens, "false" closes.
        if (raw.length === 0) return true;
        return raw === "true";
      },
      event: (value: boolean) => ({ type: value ? "CONTROLLED_OPEN" : "CONTROLLED_CLOSE" }),
      current: (_context, state) => state === "open",
    },
    closeOnSelect: { parse: (raw) => raw !== false },
    loopFocus: { parse: (raw) => raw === true },
    composite: { parse: (raw) => raw !== false },
    typeahead: { parse: (raw) => raw !== false },
    placement: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : "bottom-start"),
    },
    submenu: { parse: (raw) => raw === true },
    label: {
      parse: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : "Menu"),
    },
    navigate: { parse: (raw) => (typeof raw === "function" ? raw : undefined) },
  },
  scalars: ["isSubmenu"],
  parts: {
    trigger: {
      sig: (scope) => [scope.state, scope.props["composite"], scope.props["submenu"]].join(" "),
      attrs: (scope) => {
        const open = scope.state === "open";
        return {
          type: "button",
          id: scope.id("trigger"),
            "data-scope": "menu",
            "data-part": "trigger",
          "aria-haspopup": scope.props["composite"] !== false ? "menu" : "dialog",
          "aria-expanded": open,
          "aria-controls": scope.id("content"),
          hidden: scope.props["submenu"] === true,
          "data-state": open ? "open" : "closed",
          onClick: (): void => {
            if (scope.state === "open") {
              closeSelf(scope);
              return;
            }
            scope.send({ type: "TRIGGER_CLICK" });
            focusId(scope.id("content"));
          },
          onKeydown: (event: KeyboardEvent): void => onTriggerKeydown(scope, event),
        };
      },
    },
    triggerIndicator: {
      sig: (scope) => [scope.state].join(" "),
      attrs: (scope) => ({
        "aria-hidden": true,
        "data-state": scope.state === "open" ? "open" : "closed",
      }),
    },
    contextTrigger: {
      sig: (scope) => [`${scope.props["submenu"] === true}`].join(" "),
      attrs: (scope) => ({
        hidden: scope.props["submenu"] === true,
        onContextMenu: (event: MouseEvent): void => {
          if (scope.props["submenu"] === true) return;
          event.preventDefault();
          scope.send({ type: "CONTEXT_MENU", point: { x: event.clientX, y: event.clientY } });
          focusId(scope.id("content"));
        },
        "use:long-press": {
          delay: 700,
          onPress: (point: { x: number; y: number }): void => {
            if (scope.props["submenu"] === true) return;
            scope.send({ type: "CONTEXT_MENU", point });
            focusId(scope.id("content"));
          },
        },
      }),
    },
    positioner: {
      sig: (scope) => [scope.state].join(" "),
      attrs: (scope) => ({
        id: scope.id("positioner"),
          "data-scope": "menu",
          "data-part": "positioner",
        "data-state": scope.state === "open" ? "open" : "closed",
        style: geometryStyle(scope),
      }),
    },
    content: {
      sig: (scope) => [
        scope.state,
        asCtx(scope.context).highlightedValue,
        scope.props["composite"],
        scope.props["submenu"],
        entriesOf(scope.props).length,
      ].join(" "),
      attrs: (scope) => {
        const highlightedValue = asCtx(scope.context).highlightedValue;
        return {
          id: scope.id("content"),
            "data-scope": "menu",
            "data-part": "content",
          role: scope.props["composite"] !== false ? "menu" : "dialog",
          tabindex: 0,
          // A leaf row's instance has no rows to show: keep it out of the
          // accessibility tree and out of hit-testing entirely.
          hidden: scope.props["submenu"] === true && entriesOf(scope.props).length === 0,
          "aria-activedescendant": highlightedValue === null
            ? undefined
            : scope.id("item", highlightedValue),
          "aria-labelledby": scope.id("trigger"),
          "data-state": scope.state === "open" ? "open" : "closed",
          onKeydown: (event: KeyboardEvent): void => onContentKeydown(scope, event),
          onSubmenuclose: (event: Event): void => onSubmenuClose(scope, event),
          "use:dismissable": {
            onOutside: (event: PointerEvent): void => {
              if (isTriggerTarget(scope, event.target)) return;
              closeSelf(scope);
              reportClose(scope, false);
            },
            onEscape: (): void => {
              closeSelf(scope);
              reportClose(scope, false);
              if (scope.props["submenu"] === true) focusParent(scope);
              else focusId(scope.id("trigger"));
            },
          },
        };
      },
    },
  },
  slots: {
    itemGroup: {
      indexes: (_context, props) => blocksOf(entriesOf(props)),
      sig: (scope) => `${(scope.slot as unknown as MenuBlock).label}`,
      attrs: (scope) => {
        const block = scope.slot as unknown as MenuBlock;
        return {
          id: scope.id("itemGroup", block.id),
            "data-scope": "menu",
            "data-part": "item-group",
          role: "group",
          "aria-labelledby": block.label === null ? undefined : scope.id("itemGroupLabel", block.id),
        };
      },
    },
    itemGroupLabel: {
      indexes: (_context, props) => blocksOf(entriesOf(props)),
      sig: (scope) => `${(scope.slot as unknown as MenuBlock).label}`,
      attrs: (scope) => {
        const block = scope.slot as unknown as MenuBlock;
        return {
          id: scope.id("itemGroupLabel", block.id),
            "data-scope": "menu",
            "data-part": "item-group-label",
          hidden: block.label === null,
        };
      },
    },
    item: {
      indexes: (_context, props) =>
        blocksOf(entriesOf(props)).flatMap((block) => block.rows),
      sig: (scope) => {
        const row = scope.slot as unknown as MenuRow;
        return [
          asCtx(scope.context).highlightedValue,
          asCtx(scope.context).openSubmenu,
          row.children.length > 0,
          scope.props["composite"],
        ].join(" ");
      },
      attrs: (scope) => {
        const row = scope.slot as unknown as MenuRow;
        const ctx = asCtx(scope.context);
        const hasChildren = row.children.length > 0;
        const expanded = ctx.openSubmenu === row.value;
        const highlighted = ctx.highlightedValue === row.value;
        const bag: Record<string, unknown> = {
          id: scope.id("item", row.value),
            "data-scope": "menu",
            "data-part": "item",
          role: row.checked === undefined ? "menuitem" : "menuitemcheckbox",
          ...(row.checked === undefined ? {} : { "aria-checked": row.checked }),
          ...(row.disabled ? { "aria-disabled": true, "data-disabled": "" } : {}),
          ...(highlighted ? { "data-highlighted": "" } : {}),
          ...rowHandlers(scope, row),
        };
        if (hasChildren) {
          bag["aria-haspopup"] = scope.props["composite"] !== false ? "menu" : "dialog";
          bag["aria-expanded"] = expanded;
          bag["aria-controls"] = `${scope.id("submenu", row.value)}:content`;
          bag["data-state"] = expanded ? "open" : "closed";
          bag["use:hover-intent"] = {
            delay: 200,
            onOpen: (): void => scope.send({ type: "SUBMENU_OPEN", value: row.value }),
            onClose: (): void => scope.send({ type: "SUBMENU_CLOSE" }),
          };
        }
        return bag;
      },
    },
    itemText: {
      indexes: (_context, props) =>
        blocksOf(entriesOf(props)).flatMap((block) => block.rows),
      sig: () => "text",
      attrs: () => ({}),
    },
    itemIndicator: {
      indexes: (_context, props) =>
        blocksOf(entriesOf(props)).flatMap((block) => block.rows),
      sig: (scope) => `${(scope.slot as unknown as MenuRow).checked}`,
      attrs: (scope) => {
        const row = scope.slot as unknown as MenuRow;
        return {
          "aria-hidden": true,
          "data-state": row.checked === true ? "checked" : "unchecked",
        };
      },
    },
    itemShortcut: {
      indexes: (_context, props) =>
        blocksOf(entriesOf(props)).flatMap((block) => block.rows),
      sig: (scope) => `${(scope.slot as unknown as MenuRow).shortcut.length === 0}`,
      attrs: (scope) => ({
        hidden: (scope.slot as unknown as MenuRow).shortcut.length === 0,
      }),
    },
    itemSubmenuIndicator: {
      indexes: (_context, props) =>
        blocksOf(entriesOf(props)).flatMap((block) => block.rows),
      sig: (scope) => {
        const row = scope.slot as unknown as MenuRow;
        return `${asCtx(scope.context).openSubmenu === row.value} ${row.children.length === 0}`;
      },
      attrs: (scope) => {
        const row = scope.slot as unknown as MenuRow;
        return {
          "aria-hidden": true,
          // Self-state, not a group variant: Uno compiles
          // group-data-[state=open] into a selector lightningcss rejects
          // as a dangling combinator.
          "data-state": asCtx(scope.context).openSubmenu === row.value ? "open" : "closed",
          hidden: row.children.length === 0,
        };
      },
    },
    separator: {
      indexes: (_context, props) => blocksOf(entriesOf(props)),
      sig: (scope) => `${(scope.slot as unknown as MenuBlock).separator}`,
      attrs: (scope) => ({
        role: "separator",
        "aria-orientation": "horizontal",
        hidden: !(scope.slot as unknown as MenuBlock).separator,
      }),
    },
    // The parent level spreads this onto the child instance's element:
    // `open` carries the level's state (the attribute text the child's
    // controlled channel reads), `items` its subtree.
    submenu: {
      indexes: (_context, props) =>
        blocksOf(entriesOf(props)).flatMap((block) => block.rows),
      sig: (scope) => {
        const row = scope.slot as unknown as MenuRow;
        return `${asCtx(scope.context).openSubmenu}`;
      },
      attrs: (scope) => {
        const row = scope.slot as unknown as MenuRow;
        return {
          id: scope.id("submenu", row.value),
            "data-scope": "menu",
            "data-part": "submenu",
          open: asCtx(scope.context).openSubmenu === row.value ? "true" : "false",
          items: JSON.stringify(row.children),
          label: row.label,
        };
      },
    },
  },
  commands: {
    open: { event: () => ({ type: "OPEN" }) },
    close: { event: () => ({ type: "CLOSE" }) },
    setHighlighted: { event: (args) => ({ type: "HIGHLIGHT", value: args[0] as string | null }) },
  },
  readers: {
    isOpen: { read: (_context, state) => state === "open" },
    highlightedValue: { read: (context) => asCtx(context).highlightedValue },
  },
  methods: {
    getBlocks: {
      call: (_context, _state, _args, props) => blocksOf(entriesOf(props)),
    },
    getRows: {
      call: (_context, _state, args) => (args[0] as MenuBlock).rows,
    },
  },
  events: {
    "open-change": {
      prop: "onOpenChange",
      watch: (_context, state) => [state === "open"],
      detail: (watched) => ({ open: watched[0] as boolean }),
    },
    select: {
      prop: "onSelect",
      watch: () => [],
      detail: (watched) => ({ value: watched[0] as string }),
      select: (event) => {
        if (event.type !== "ITEM_CLICK") return null;
        return { value: event["value"] as string };
      },
    },
    "highlight-change": {
      prop: "onHighlightChange",
      watch: (context) => [asCtx(context).highlightedValue],
      detail: (watched) => ({ highlightedValue: watched[0] as string | null }),
    },
  },
};

export const menu = defineComponent<MenuContext, MenuEvent, MenuApi>(def);
