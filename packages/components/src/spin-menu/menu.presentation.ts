import {
  ariaHidden,
  ariaLabelledBy,
  ariaOrientation,
  defineComponent,
  disclosureTrigger,
  listSurface,
  optionRow,
  type ApiOf,
  type ComponentDef,
  type ScopeFor,
  type SlotScopeFor,
} from "@spin/runtime";
import { ROVING_KEYS } from "../shared/keyboard.ts";
import { menu as menuMachine } from "./menu.machine.ts";
import {
  entriesOf,
  type MenuArgs,
  type MenuBlock,
  type MenuContext,
  type MenuEntry,
  type MenuRow,
  type MenuState,
} from "./menu.state.ts";
import type {
  MenuEvents,
  MenuHighlightChange,
  MenuOpenChange,
  MenuSelect,
} from "./menu.events.ts";

/**
 * Menu bindings: the DOM contract as data. The machine owns open/closed,
 * the highlight, the anchor point and the open submenu on this level; this
 * file maps transport inputs to the machine's arguments, rows to attribute
 * bags, and commands to sends. Navigation computes its target against
 * context rows and sends it in — the machine never walks data.
 *
 * A submenu level is its own bridge instance; levels meet through the
 * element tree. A parent writes the child instance's `open` attribute,
 * and the child reports a close back up as a bubbling `submenuclose`
 * event so the parent clears the context that drove it.
 */

type ScopeLike = ScopeFor<MenuContext, MenuEvents, MenuState>;
type SlotLike<R> = SlotScopeFor<R, MenuContext, MenuEvents, MenuState>;

/** The trigger exclusion travels in the dismissable action's params
 * (excludeId/excludeParent) — no def-side DOM query. */

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

const rowsByEntries = new WeakMap<readonly MenuEntry[], readonly MenuRow[]>();

const rowsOf = (entries: readonly MenuEntry[]): readonly MenuRow[] => {
  const hit = rowsByEntries.get(entries);
  if (hit !== undefined) return hit;
  const rows: MenuRow[] = buildRows(entries);
  rowsByEntries.set(entries, rows);
  return rows;
};

const buildRows = (entries: readonly MenuEntry[]): MenuRow[] => {
  const rows: MenuRow[] = [];
  for (const entry of entries) {
    if ("value" in entry) {
      const row = toRow(entry);
      if (row !== undefined) rows.push(row);
    } else if ("group" in entry) {
      for (const sub of entry.items) {
        const subEntry = sub;
        if (!("value" in subEntry)) continue;
        const row = toRow(subEntry);
        if (row !== undefined) rows.push(row);
      }
    }
  }
  return rows;
};

const blocksCache = new WeakMap<readonly MenuEntry[], readonly MenuBlock[]>();

const blocksOf = (entries: readonly MenuEntry[]): readonly MenuBlock[] => {
  const hit = blocksCache.get(entries);
  if (hit !== undefined) return hit;
  const built: MenuBlock[] = [];
  let label: string | null = null;
  let rows: MenuRow[] = [];
  const flush = (): void => {
    if (rows.length > 0) {
      built.push({ id: `group:${built.length}`, label, rows, separator: false });
      rows = [];
    }
    label = null;
  };
  for (const entry of entries) {
    if ("separator" in entry) {
      flush();
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

const rowsOfEntries = (entries: readonly MenuEntry[]): readonly MenuRow[] => rowsOf(entries);

const enabledValues = (scope: ScopeLike): readonly MenuRow[] =>
  rowsOfEntries(scope.context.entries).filter((row) => !row.disabled);

/** Neighbor with loop wrap (menus always loop, Zag's model). */
const neighbor = (scope: ScopeLike, value: string, direction: 1 | -1): string | null => {
  const order = enabledValues(scope);
  if (order.length === 0) return null;
  const at = order.findIndex((entry) => entry.value === value);
  if (at < 0) return (direction > 0 ? order[0] : order[order.length - 1])?.value ?? null;
  const loop = scope.context.loopFocus;
  const next = at + direction;
  if (next < 0) return loop ? order[order.length - 1]?.value ?? null : order[at]?.value ?? null;
  if (next >= order.length) return loop ? order[0]?.value ?? null : order[at]?.value ?? null;
  return order[next]?.value ?? null;
};

const rowByValue = (scope: ScopeLike, value: string | null): MenuRow | undefined =>
  value === null
    ? undefined
    : rowsOfEntries(scope.context.entries).find((row) => row.value === value);

/** Typeahead state, keyed by bridge send: the connect is long-lived, but a
 * def-built api may rebuild it per tick, and a fresh buffer would erase the
 * sequence. */
const typeaheadByBridge = new WeakMap<object, { keys: string; at: number }>();
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

/** Recipe-driven rows arrive through getBlocks/getRows iteration. */
const isMenuBlock = (value: unknown): value is MenuBlock => {
  if (typeof value !== "object" || value === null) return false;
  const rows: unknown = Reflect.get(value, "rows");
  return Array.isArray(rows);
};

const highlight = (scope: ScopeLike, value: string | null): void => {
  scope.send({ type: "HIGHLIGHT", value });
};

/** Row handlers, built once per row per bridge: the scope reads live
 * through proxies, so a cached closure never goes stale. */
type RowHandlerSet = {
  readonly onPointerMove: (event: PointerEvent) => void;
  readonly onClick: (event: MouseEvent) => void;
};
const rowHandlersByBridge = new WeakMap<object, WeakMap<MenuRow, RowHandlerSet>>();
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
      activate(scope, row);
    },
  };
  byRow.set(row, made);
  return made;
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
  const match = rowsOfEntries(scope.context.entries)
    .find((row) => !row.disabled && row.label.toLowerCase().startsWith(needle));
  if (match !== undefined) highlight(scope, match.value);
};

const isPrintable = (event: KeyboardEvent): boolean =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

/** Focus follows through the settled effect. */
const openSubmenu = (scope: ScopeLike, value: string): void => {
  scope.send({ type: "SUBMENU_OPEN", value });
};

const activate = (scope: ScopeLike, row: MenuRow): void => {
  if (row.disabled) return;
  if (row.children.length > 0) {
    openSubmenu(scope, row.value);
    return;
  }
  scope.send({ type: "ITEM_CLICK", value: row.value });
  if (scope.context.closeOnSelect) {
    closeSelf(scope);
    reportClose(scope, true);
  }
};

const onContentKeydown = (scope: ScopeLike, event: KeyboardEvent): void => {
  if (event.defaultPrevented) return;
  const current = scope.context.highlightedValue;
  // Horizontal arrows are structural (submenu in/out), not roving:
  // they bypass the intent table, which only knows next/prev/first/last.
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
    const intent = ROVING_KEYS[event.key];
    if (intent !== undefined) {
      if (intent.intent === "next" || intent.intent === "prev") {
        const next = neighbor(scope, current ?? "", intent.intent === "next" ? 1 : -1);
        if (next !== null) {
          event.preventDefault();
          scope.send({ type: "HIGHLIGHT", value: next });
        }
        return;
      }
      if (intent.intent === "first" || intent.intent === "last") {
        event.preventDefault();
        const list = enabledValues(scope);
        const row = intent.intent === "first" ? list[0] : list[list.length - 1];
        if (row !== undefined) scope.send({ type: "HIGHLIGHT", value: row.value });
        return;
      }
    }
  }
  switch (event.key) {
    case "ArrowRight": {
      const row = rowByValue(scope, current);
      if (row !== undefined && row.children.length > 0) openSubmenu(scope, row.value);
      break;
    }
    case "ArrowLeft": {
      if (!scope.context.isSubmenu) break;
      closeSelf(scope);
      reportClose(scope, false);
      break;
    }
    case "Enter": {
      const row = rowByValue(scope, current);
      if (row !== undefined) activate(scope, row);
      break;
    }
    case " ": {
      if (typeaheadOf(scope).keys.length > 0) {
        typeaheadMatch(scope, event.key);
        break;
      }
      const row = rowByValue(scope, current);
      if (row !== undefined) activate(scope, row);
      break;
    }
    default:
      if (scope.context.typeahead && isPrintable(event)) typeaheadMatch(scope, event.key);
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
    const list = enabledValues(scope);
    const row = from === "first" ? list[0] : list[list.length - 1];
    if (row !== undefined) scope.send({ type: "HIGHLIGHT", value: row.value });
  };
  switch (event.key) {
    case "ArrowDown":
    case "Enter":
      if (open) {
        const next = neighbor(scope, scope.context.highlightedValue ?? "", 1);
        if (next !== null) scope.send({ type: "HIGHLIGHT", value: next });
      } else openItem("first");
      break;
    case "ArrowUp":
      if (open) {
        const next = neighbor(scope, scope.context.highlightedValue ?? "", -1);
        if (next !== null) scope.send({ type: "HIGHLIGHT", value: next });
      } else openItem("last");
      break;
    case " ":
      if (open) {
        const next = neighbor(scope, scope.context.highlightedValue ?? "", 1);
        if (next !== null) scope.send({ type: "HIGHLIGHT", value: next });
      } else openItem("first");
      break;
    case "Escape":
      if (open) closeSelf(scope);
      break;
    default:
      return;
  }
  event.preventDefault();
};

const onSubmenuClose = (scope: ScopeLike, event: Event): void => {
  if (!("detail" in event)) return;
  const detail: unknown = event.detail;
  const select = typeof detail === "object" && detail !== null && Reflect.get(detail, "select") === true;
  if (select) {
    if (scope.context.closeOnSelect) closeSelf(scope);
    return;
  }
  const target = event.target;
  const openValue = scope.context.openSubmenu;
  if (openValue === null || !(target instanceof Element)) return;
  if (target.id !== scope.id("submenu", openValue)) return;
  scope.send({ type: "SUBMENU_CLOSE" });
};

export const def = {
  name: "menu",
  machine: (args: MenuArgs, authored: (name: string) => boolean) => menuMachine(args, authored),
  start: (props, authored) => {
    if (authored("open")) return props["open"] === true ? "open" : "closed";
    return props["defaultOpen"] === true ? "open" : "closed";
  },
  reconcile: ({ state, parsed, authored, send }) => {
    // The items arrive as a host write: a parent menu hands its subtree
    // over after the child has connected, so the machine's first entries
    // are only the first word.
    const entries = entriesOf(parsed["items"]);
    send({ type: "ENTRIES.SET", entries });
    // The host owns the panel when it authored `open`: the machine
    // follows the prop, and the machine's own move is what reports it.
    // The prop drives the machine's STATE, not a context field, so it
    // cannot travel as a contract entry — the reconcile keeps it.
    if (!authored("open")) return false;
    const open = parsed["open"] === true;
    if (open === (state === "open")) return false;
    send({ type: open ? "CONTROLLED_OPEN" : "CONTROLLED_CLOSE" });
    return true;
  },
  parts: {
    trigger: {
      attrs: (scope: ScopeLike) => {
        const open = scope.state === "open";
        return {
          type: "button",
          id: scope.id("trigger"),
          "data-scope": "menu",
          "data-part": "trigger",
          ...disclosureTrigger(scope, {
            expanded: open,
            hasPopup: scope.context.composite ? "menu" : "dialog",
            controls: { part: "content" },
          }),
          hidden: scope.context.isSubmenu,
          "data-state": open ? "open" : "closed",
          onClick: (): void => {
            if (scope.state === "open") {
              closeSelf(scope);
              return;
            }
            scope.send({ type: "TRIGGER_CLICK" });
          },
          onKeydown: (event: KeyboardEvent): void => onTriggerKeydown(scope, event),
        };
      },
    },
    triggerIndicator: {
      attrs: (scope: ScopeLike) => ({
        ...ariaHidden(true),
        "data-state": scope.state === "open" ? "open" : "closed",
      }),
    },
    contextTrigger: {
      attrs: (scope: ScopeLike) => ({
        hidden: scope.context.isSubmenu,
        onContextMenu: (event: MouseEvent): void => {
          if (scope.context.isSubmenu) return;
          event.preventDefault();
          scope.send({ type: "CONTEXT_MENU", point: { x: event.clientX, y: event.clientY } });
        },
        "use:long-press": {
          delay: 700,
          onPress: (point: { x: number; y: number }): void => {
            if (scope.context.isSubmenu) return;
            scope.send({ type: "CONTEXT_MENU", point });
          },
        },
      }),
    },
    positioner: {
      attrs: (scope: ScopeLike) => ({
        id: scope.id("positioner"),
        "data-scope": "menu",
        "data-part": "positioner",
        "data-state": scope.state === "open" ? "open" : "closed",
        // Positioning is the anchor action's job: it measures the trigger,
        // flips on viewport veto, writes literals, and re-runs on
        // resize/scroll.
        "use:anchor": { placement: "bottom", offset: 8 },
      }),
    },
    content: {
      attrs: (scope: ScopeLike) => {
        const highlightedValue = scope.context.highlightedValue;
        return {
          id: scope.id("content"),
          "data-scope": "menu",
          "data-part": "content",
          role: scope.context.composite ? "menu" : "dialog",
          tabindex: 0,
          // A leaf row's instance has no rows to show: keep it out of the
          // accessibility tree and out of hit-testing entirely.
          hidden: scope.context.isSubmenu && scope.context.entries.length === 0,
          ...listSurface(scope, {
            activeDescendant: highlightedValue === null
              ? undefined
              : { part: "item", slot: highlightedValue },
            labelledBy: { part: "trigger" },
          }),
          "data-state": scope.state === "open" ? "open" : "closed",
          class: "rounded-lg border border-solid border-border bg-surface-raised p-1 shadow-lg",
          onKeydown: (event: KeyboardEvent): void => onContentKeydown(scope, event),
          onSubmenuclose: (event: Event): void => onSubmenuClose(scope, event),
          "use:dismissable": {
            excludeId: scope.context.isSubmenu ? undefined : scope.id("trigger"),
            excludeParent: scope.context.isSubmenu,
            onOutside: (): void => {
              closeSelf(scope);
              reportClose(scope, false);
            },
            onEscape: (): void => {
              closeSelf(scope);
              reportClose(scope, false);
            },
          },
        };
      },
    },
  },
  slots: {
    itemGroup: {
      indexes: (context) => blocksOf(context.entries),
      attrs: (scope: SlotLike<MenuBlock>) => {
        const block = scope.slot;
        return {
          id: scope.id("itemGroup", block.id),
          "data-scope": "menu",
          "data-part": "item-group",
          role: "group",
          ...ariaLabelledBy(
            scope,
            block.label === null ? undefined : { part: "itemGroupLabel", slot: block.id },
          ),
        };
      },
    },
    itemGroupLabel: {
      indexes: (context) => blocksOf(context.entries),
      attrs: (scope: SlotLike<MenuBlock>) => {
        const block = scope.slot;
        return {
          id: scope.id("itemGroupLabel", block.id),
          "data-scope": "menu",
          "data-part": "item-group-label",
          hidden: block.label === null,
        };
      },
    },
    item: {
      indexes: (context) => blocksOf(context.entries).flatMap((block) => block.rows),
      attrs: (scope: SlotLike<MenuRow>) => {
        const row = scope.slot;
        const ctx = scope.context;
        const hasChildren = row.children.length > 0;
        const expanded = ctx.openSubmenu === row.value;
        const highlighted = ctx.highlightedValue === row.value;
        const bag: Record<string, unknown> = {
          id: scope.id("item", row.value),
          "data-scope": "menu",
          "data-part": "item",
          role: row.checked === undefined ? "menuitem" : "menuitemcheckbox",
          ...optionRow({
            ...(row.checked === undefined ? {} : { checked: row.checked }),
            ...(row.disabled ? { disabled: true } : {}),
          }),
          ...(row.disabled ? { "data-disabled": "" } : {}),
          ...(highlighted ? { "data-highlighted": "" } : {}),
          ...rowHandlers(scope, row),
        };
        if (hasChildren) {
          const trigger = disclosureTrigger(scope, {
            expanded,
            hasPopup: scope.context.composite ? "menu" : "dialog",
            controls: { id: `${scope.id("submenu", row.value)}:content` },
          });
          bag["aria-haspopup"] = trigger["aria-haspopup"];
          bag["aria-expanded"] = trigger["aria-expanded"];
          bag["aria-controls"] = trigger["aria-controls"];
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
      indexes: (context) => blocksOf(context.entries).flatMap((block) => block.rows),
      attrs: () => ({}),
    },
    itemIndicator: {
      indexes: (context) => blocksOf(context.entries).flatMap((block) => block.rows),
      attrs: (scope: SlotLike<MenuRow>) => {
        const row = scope.slot;
        return {
          ...ariaHidden(true),
          "data-checked": row.checked === true ? "" : undefined,
        };
      },
    },
    itemShortcut: {
      indexes: (context) => blocksOf(context.entries).flatMap((block) => block.rows),
      attrs: (scope: SlotLike<MenuRow>) => ({
        hidden: scope.slot.shortcut.length === 0,
      }),
    },
    itemSubmenuIndicator: {
      indexes: (context) => blocksOf(context.entries).flatMap((block) => block.rows),
      attrs: (scope: SlotLike<MenuRow>) => {
        const row = scope.slot;
        return {
          ...ariaHidden(true),
          // Self-state, not a group variant: Uno compiles
          // group-data-[state=open] into a selector lightningcss rejects
          // as a dangling combinator.
          "data-state": scope.context.openSubmenu === row.value ? "open" : "closed",
          hidden: row.children.length === 0,
        };
      },
    },
    separator: {
      indexes: (context) => blocksOf(context.entries),
      attrs: (scope: SlotLike<MenuBlock>) => ({
        role: "separator",
        ...ariaOrientation("horizontal"),
        hidden: !scope.slot.separator,
      }),
    },
    // The parent level spreads this onto the child instance's element:
    // `open` reflects the level's state, `items` its subtree.
    // Transport coerces the JSON string; the machine shapes on receipt.
    submenu: {
      indexes: (context) => blocksOf(context.entries).flatMap((block) => block.rows),
      attrs: (scope: SlotLike<MenuRow>) => {
        const row = scope.slot;
        return {
          id: scope.id("submenu", row.value),
          "data-scope": "menu",
          "data-part": "submenu",
          open: scope.context.openSubmenu === row.value ? "true" : "false",
        // The subtree crosses as values: the child instance's transport
        // coerces what the host writes, so no JSON text crosses here.
        items: row.children,
        label: row.label,
        };
      },
    },
  },
  commands: {
    open: { event: () => ({ type: "OPEN" as const }) },
    close: { event: () => ({ type: "CLOSE" as const }) },
    setHighlighted: { event: ([value]: [value: string | null]) => ({ type: "HIGHLIGHT" as const, value }) },
  },
  readers: {
    isOpen: { read: (_context, state) => state === "open" },
    highlightedValue: { read: (context: MenuContext) => context.highlightedValue },
  },
  methods: {
    getBlocks: {
      call: (context: MenuContext) => blocksOf(context.entries),
    },
    getRows: {
      call: (_context: MenuContext, _state, [block]: [block: MenuBlock]): readonly MenuRow[] => {
        if (!isMenuBlock(block)) return [];
        return block.rows;
      },
    },
  },
  events: {
    "open-change": {
      prop: "onOpenChange",
      watch: (_context: MenuContext, state) => [state === "open"],
      detail: (watched: readonly [boolean]) => ({ open: watched[0] }),
    },
    select: {
      prop: "onSelect",
      watch: () => [],
      detail: (watched: readonly [string]) => ({ value: watched[0] }),
      select: (event) => {
        if (event.type !== "ITEM_CLICK") return null;
        const value = event["value"];
        if (typeof value !== "string") return null;
        return { value };
      },
    },
    "highlight-change": {
      prop: "onHighlightChange",
      watch: (context: MenuContext) => [context.highlightedValue],
      detail: (watched: readonly [string | null]) => ({ highlightedValue: watched[0] }),
    },
  },
  settled: ({ event, focus }) => {
    if (event.type === "HIGHLIGHT") {
      const value = event["value"];
      if (typeof value === "string") focus("item", value);
    } else if (event.type === "SUBMENU_OPEN") {
      const v = event["value"];
      if (typeof v === "string") focus("submenu", v);
    } else if (event.type === "TRIGGER_CLICK" || event.type === "OPEN") {
      focus("content");
    }
  },
} satisfies ComponentDef<MenuContext, MenuEvents, Record<string, unknown>, MenuArgs, MenuState>;

export type MenuApi = ApiOf<typeof def>;
export const menu = defineComponent<MenuContext, MenuEvents, MenuApi, MenuArgs, MenuState>(def);
