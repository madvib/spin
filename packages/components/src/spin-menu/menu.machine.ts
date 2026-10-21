import { createMachine, type Machine, type Service, type EventUnion, type MachineSpec } from "@spin/runtime/fsm";
import { coerceJsonArray, defaultTwin } from "@spin/runtime";
const clearAnchor = () : Partial<MenuContext> => { return ({ anchorPoint: null }); };

const clearAll = () : Partial<MenuContext> => { return ({ highlightedValue: null, openSubmenu: null, anchorPoint: null }); };



/**
 * Menu machine: open/closed, plus where the highlight sits.
 *
 * The Zag machine this replaces has six states, and the interesting fact is
 * what they are: `opening`, `opening:contextmenu` and `closing` are not
 * structure — they exist to hold a timer (hover-intent delay, long-press,
 * close delay). In this architecture timers are reflexes, so they leave:
 * `use:hover-intent` and `use:long-press` are actions on the trigger that
 * send OPEN when the delay elapses, and the machine has no transitional
 * states at all.
 *
 * Submenus are likewise not statechart children in Zag — each submenu is a
 * separate machine instance and the parent's context tracks the highlighted
 * child. Same answer here: `openSubmenu` is a context map keyed by item
 * value, exactly as tree-view tracks per-node loading. This is why a flat
 * fork covers a menu: there is no genuine hierarchy to model, only
 * per-instance state.
 *
 * Context-menu anchoring (`anchorPoint`) stays: it is input, like a
 * click coordinate, not state that transitions.
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
  readonly checked: boolean | undefined;
  readonly children: readonly MenuEntry[];
}

export interface MenuBlock {
  readonly id: string;
  readonly label: string | null;
  readonly rows: readonly MenuRow[];
  readonly separator: boolean;
}

export interface MenuArgs {
  items?: string | readonly MenuEntry[];
  submenu?: boolean;
}

export interface MenuContext {
  highlightedValue: string | null;
  openSubmenu: string | null;
  anchorPoint: { x: number; y: number } | null;
  isSubmenu: boolean;
  // Bags derive rows/blocks per read, memoized on this identity;
  // submenu children stay nested for child instances.
  readonly entries: readonly MenuEntry[];
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

export interface MenuEvents {
  "OPEN": {};
  "CLOSE": {};
  "CONTROLLED_OPEN": {};
  "CONTROLLED_CLOSE": {};
  "TRIGGER_CLICK": {};
  "CONTEXT_MENU": { point: { x: number; y: number } };
  "HIGHLIGHT": { value: string | null };
  "ENTRIES.SET": { entries: readonly MenuEntry[] };
  "SUBMENU_OPEN": { value: string };
  "SUBMENU_CLOSE": {};
  "ITEM_CLICK": { value: string };
}

export type MenuEvent = EventUnion<MenuEvents>;


/** Transport delivers objects or nothing. */
function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null;
}

function parseEntry(raw: unknown): MenuEntry | undefined {
  if (!isRecord(raw)) return undefined;
  const record = raw;
  if (record["separator"] === true) return { separator: true };
  const group = record["group"];
  const items = record["items"];
  if (typeof group === "string" && Array.isArray(items)) {
    return {
      group,
      items: items.flatMap((item) => {
        const entry = parseEntry(item);
        return entry === undefined ? [] : [entry];
      }),
    };
  }
  const value = record["value"];
  const label = record["label"];
  if (typeof value !== "string" || typeof label !== "string") return undefined;
  const row: {
    value: string;
    label: string;
    shortcut?: string;
    disabled?: boolean;
    checked?: boolean;
    children?: readonly MenuEntry[];
  } = { value, label };
  if (typeof record["shortcut"] === "string") row.shortcut = record["shortcut"];
  if (typeof record["disabled"] === "boolean") row.disabled = record["disabled"];
  if (typeof record["checked"] === "boolean") row.checked = record["checked"];
  if (Array.isArray(record["children"])) {
    row.children = record["children"].flatMap((child) => {
      const entry = parseEntry(child);
      return entry === undefined ? [] : [entry];
    });
  }
  return row;
}

export function entriesOf(raw: unknown): readonly MenuEntry[] {
  // Arrays arrive shaped; JSON text (nested trees the grammar cannot
  // type) coerces through the framework grammar first.
  const source: readonly unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? coerceJsonArray(raw, [])
      : [];
  const entries: MenuEntry[] = [];
  for (const item of source) {
    const entry = parseEntry(item);
    if (entry !== undefined) entries.push(entry);
  }
  return entries;
}

export function initial(args: MenuArgs = {}, authored: (name: string) => boolean): MenuContext {
  // A channel: the host's write, or the machine's own default. The twin
  // is the framework's convention — a host that wrote `defaultSubmenu`
  // wrote the channel too.
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  return {
    highlightedValue: null,
    openSubmenu: null,
    anchorPoint: null,
    // The contract names the field `isSubmenu`; the element's prop is
    // `submenu`, and the prop is the one the host writes.
    isSubmenu: written("submenu") ? args.submenu === true : false,
    entries: entriesOf(args.items),
  };
}

const config: MachineSpec<MenuContext, MenuEvents> = {
  id: "menu",
  initial: "closed",
  context: {
    highlightedValue: null as string | null,
    openSubmenu: null as string | null,
    anchorPoint: null as { x: number; y: number } | null,
    isSubmenu: false,
    entries: [] as readonly MenuEntry[],
  },
  states: {
    closed: {
      on: {
        OPEN: { target: "open", assign: clearAnchor },
        CONTROLLED_OPEN: { target: "open", assign: clearAnchor },
        TRIGGER_CLICK: { target: "open", assign: clearAnchor },
        CONTEXT_MENU: { target: "open", assign: (_ctx, e) => { return e.type === "CONTEXT_MENU" ? { anchorPoint: e.point, highlightedValue: null } : {}; } },
      },
    },
    open: {
      on: {
        CLOSE: { target: "closed", assign: clearAll },
        CONTROLLED_CLOSE: { target: "closed", assign: clearAll },
        HIGHLIGHT: { assign: (ctx, e) => { return e.type === "HIGHLIGHT" && e.value !== ctx.highlightedValue
        ? { highlightedValue: e.value, openSubmenu: null }
        : {}; } },
        "ENTRIES.SET": { assign: (ctx, event) => {
      return sameEntries(ctx.entries, event.entries) ? {} : { entries: event.entries };
    } },
        SUBMENU_OPEN: { assign: (ctx, e) => { return e.type === "SUBMENU_OPEN" ? { openSubmenu: e.value, highlightedValue: e.value } : { openSubmenu: ctx.openSubmenu }; } },
        SUBMENU_CLOSE: { assign: () => { return ({ openSubmenu: null }); } },
        ITEM_CLICK: { assign: [() => { return ({}); }, clearAll] },
      },
    },
  },
};

function sameEntries(a: readonly MenuEntry[], b: readonly MenuEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    if (other === undefined) return false;
    const sep = (candidate: MenuEntry): boolean => "separator" in candidate && candidate.separator === true;
    if (sep(entry) || sep(other)) return sep(entry) === sep(other);
    if ("group" in entry || "group" in other) {
      if (!("group" in entry) || !("group" in other)) return false;
      if (entry.group !== other.group) return false;
      return sameEntries(entry.items, other.items);
    }
    if (!("value" in entry) || !("value" in other)) return false;
    if (entry.value !== other.value || entry.label !== other.label) return false;
    if (entry.shortcut !== other.shortcut) return false;
    if (entry.disabled !== other.disabled) return false;
    if (entry.checked !== other.checked) return false;
    return sameEntries(entry.children ?? [], other.children ?? []);
  });
}

const implementations = {};

export type MenuService = Service<MenuContext, MenuEvent>;

export function menu(
  args: MenuArgs = {},
  authored: (name: string) => boolean,
): Machine<MenuContext, MenuEvents> {
  return createMachine<MenuContext, MenuEvents>({
    ...config,
    context: initial(args, authored),
    /**
     * The `open` prop is NOT here: it drives the machine's STATE, not a
     * context field, so the element's reconcile keeps it in step.
     */
    fields: {
      isSubmenu: {},
    },
  });
}
