import { createMachine, type Machine, type Service, type MachineSpec } from "@spin/runtime/fsm";
import type {
  MenuArgs,
  MenuBlock,
  MenuContext,
  MenuEntry,
  MenuRow,
  MenuState,
} from "./menu.state.ts";
import { entriesOf, initial } from "./menu.state.ts";
import type { MenuEvent, MenuEvents } from "./menu.events.ts";
const clearAnchor = () : Partial<MenuContext> => { return ({ anchorPoint: null }); };

const clearAll = () : Partial<MenuContext> => { return ({ highlightedValue: null, openSubmenu: null, anchorPoint: null }); };



/**
 * Menu machine: open/closed, plus where the highlight sits.
 *
 * The machine this replaces has six states, and the interesting fact is
 * what they are: `opening`, `opening:contextmenu` and `closing` are not
 * structure — they exist to hold a timer (hover-intent delay, long-press,
 * close delay). In this architecture timers are reflexes, so they leave:
 * `use:hover-intent` and `use:long-press` are actions on the trigger that
 * send OPEN when the delay elapses, and the machine has no transitional
 * states at all.
 *
 * Submenus are likewise not statechart children — each submenu is a
 * separate machine instance and the parent's context tracks the highlighted
 * child. Same answer here: `openSubmenu` is a context map keyed by item
 * value, exactly as tree-view tracks per-node loading. This is why a flat
 * fork covers a menu: there is no genuine hierarchy to model, only
 * per-instance state.
 *
 * Context-menu anchoring (`anchorPoint`) stays: it is input, like a
 * click coordinate, not state that transitions.
 */

const config: MachineSpec<MenuContext, MenuEvents, MenuState> = {
  id: "menu",
  initial: "closed",
  context: {
    highlightedValue: null as string | null,
    openSubmenu: null as string | null,
    anchorPoint: null as { x: number; y: number } | null,
    isSubmenu: false,
    loopFocus: false,
    closeOnSelect: false,
    typeahead: true,
    composite: true,
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
): Machine<MenuContext, MenuEvents, MenuState> {
  return createMachine<MenuContext, MenuEvents, MenuState>({
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
