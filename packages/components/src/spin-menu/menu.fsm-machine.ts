import type { FsmService } from "@spin/runtime/fsm";

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

export interface MenuContext {
  /** Which item is highlighted, at any menu level (one map per instance). */
  highlightedValue: string | null;
  /** Item value whose submenu is open, on this level. */
  openSubmenu: string | null;
  /** Pointer coordinate for a context menu; null for trigger-driven ones. */
  anchorPoint: { x: number; y: number } | null;
  /** Syncs from scope: which item is the submenu trigger for this instance. */
  isSubmenu: boolean;
}

export type MenuEvent =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "CONTROLLED_OPEN" }
  | { type: "CONTROLLED_CLOSE" }
  | { type: "TRIGGER_CLICK" }
  | { type: "CONTEXT_MENU"; point: { x: number; y: number } }
  | { type: "HIGHLIGHT"; value: string | null }
  | { type: "SUBMENU_OPEN"; value: string }
  | { type: "SUBMENU_CLOSE" }
  | { type: "ITEM_CLICK"; value: string };

export const config = {
  id: "menu",
  initial: "closed",
  context: {
    highlightedValue: null as string | null,
    openSubmenu: null as string | null,
    anchorPoint: null as { x: number; y: number } | null,
    isSubmenu: false,
  },
  states: {
    closed: {
      on: {
        OPEN: { target: "open", actions: [{ assign: "clearAnchor" }] },
        CONTROLLED_OPEN: { target: "open", actions: [{ assign: "clearAnchor" }] },
        TRIGGER_CLICK: { target: "open", actions: [{ assign: "clearAnchor" }] },
        CONTEXT_MENU: { target: "open", actions: [{ assign: "setAnchor" }] },
      },
    },
    open: {
      on: {
        CLOSE: { target: "closed", actions: [{ assign: "clearAll" }] },
        CONTROLLED_CLOSE: { target: "closed", actions: [{ assign: "clearAll" }] },
        HIGHLIGHT: { actions: [{ assign: "highlight" }] },
        SUBMENU_OPEN: { actions: [{ assign: "openSubmenu" }] },
        SUBMENU_CLOSE: { actions: [{ assign: "closeSubmenu" }] },
        ITEM_CLICK: { actions: [{ assign: "select" }, { assign: "clearAll" }] },
      },
    },
  },
};

export const implementations = {
  assigns: {
    clearAnchor: (): Partial<MenuContext> => ({ anchorPoint: null }),
    setAnchor: (_ctx: MenuContext, e: MenuEvent): Partial<MenuContext> =>
      e.type === "CONTEXT_MENU" ? { anchorPoint: e.point, highlightedValue: null } : {},
    clearAll: (): Partial<MenuContext> => ({ highlightedValue: null, openSubmenu: null, anchorPoint: null }),
    highlight: (ctx: MenuContext, e: MenuEvent): Partial<MenuContext> =>
      e.type === "HIGHLIGHT" && e.value !== ctx.highlightedValue
        ? { highlightedValue: e.value, openSubmenu: null }
        : {},
    openSubmenu: (ctx: MenuContext, e: MenuEvent): Partial<MenuContext> =>
      e.type === "SUBMENU_OPEN" ? { openSubmenu: e.value, highlightedValue: e.value } : { openSubmenu: ctx.openSubmenu },
    closeSubmenu: (ctx: MenuContext): Partial<MenuContext> => ({ openSubmenu: null }),
    /** The bridge relays ITEM_CLICK as a select event; context keeps the last pick. */
    select: (): Partial<MenuContext> => ({}),
  },
};

export type MenuService = FsmService<MenuContext, MenuEvent>;
