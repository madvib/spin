/**
 * Navigation-menu machine: the closed and open modes, and the pointer
 * gesture that moves between them.
 *
 * Zag holds navigation-menu in ONE state with the open item as context —
 * but the modes are real here: with a panel open the keyboard walks INTO
 * it, and without one LEFT/RIGHT move between the top-level items. That
 * legality difference is what earns the machine; the open-delay and
 * close-delay clocks themselves are the `hover-delay` action on the item
 * bags, and the viewport's geometry rides the anchor channel.
 *
 * The pointer handoff is the one subtlety this owns: leaving an item
 * starts a close clock, and entering the open panel (or the next item)
 * cancels it. The connect maps the action's reports onto those events,
 * so the machine never holds a timer.
 */

export type NavValue = string;

export interface NavItemRecord {
  readonly value: NavValue;
  readonly label: string;
}

export interface NavigationMenuContext {
  /** The open item; "" when no panel is open. */
  value: NavValue;
  /** The item the last transition came from, for the viewport slide. */
  previousValue: NavValue;
  /** The scalars the assigns read, synced from scope by the bridge. */
  openDelay: number;
  closeDelay: number;
  orientation: "horizontal" | "vertical";
  disabled: boolean;
}

export interface NavigationMenuValueChange {
  readonly value: NavValue;
  readonly previousValue: NavValue;
}

export type NavigationMenuEvent =
  | { type: "ITEM.ENTER"; value: NavValue }
  | { type: "ITEM.TOGGLE"; value: NavValue }
  | { type: "CLOSE" }
  | { type: "VALUE.SET"; value: NavValue };

export const config = {
  id: "navigation-menu",
  initial: "idle",
  context: {
    value: "" as NavValue,
    previousValue: "" as NavValue,
    openDelay: 200,
    closeDelay: 300,
    orientation: "horizontal" as "horizontal" | "vertical",
    disabled: false,
  },
  on: {
    "VALUE.SET": [{ actions: [{ assign: "setValue" }] }],
    "CLOSE": [{ actions: [{ assign: "closeAll" }] }],
  },
  states: {
    idle: {
      on: {
        // Closed: an enter opens after the action's open delay, a toggle
        // opens at once (a click has no dwell).
        "ITEM.ENTER": [{ target: "open", actions: [{ assign: "openFrom" }] }],
        "ITEM.TOGGLE": [{ target: "open", actions: [{ assign: "toggleOpen" }] }],
      },
    },
    open: {
      on: {
        // Open: an enter on another item swaps (the dwell is skipped —
        // a swap while open is immediate). The panel's own enter cancels
        // the pending close at the action, so it needs no event here.
        "ITEM.ENTER": [{ actions: [{ assign: "swapFrom" }] }],
        "ITEM.TOGGLE": [{ target: "idle", actions: [{ assign: "toggleOpen" }] }],
        "CLOSE": [{ target: "idle", actions: [{ assign: "closeAll" }] }],
      },
    },
  },
};

export const implementations = {
  conds: {},
  assigns: {
    setValue: (_ctx: NavigationMenuContext, e: NavigationMenuEvent): Partial<NavigationMenuContext> => {
      if (e.type !== "VALUE.SET") return {};
      return { previousValue: _ctx.value, value: e.value };
    },
    openFrom: (ctx: NavigationMenuContext, e: NavigationMenuEvent): Partial<NavigationMenuContext> => {
      if (e.type !== "ITEM.ENTER") return {};
      return { previousValue: ctx.value, value: e.value };
    },
    swapFrom: (ctx: NavigationMenuContext, e: NavigationMenuEvent): Partial<NavigationMenuContext> => {
      if (e.type !== "ITEM.ENTER") return {};
      // A swap keeps the previous for the slide; re-entering the open item
      // is a no-op.
      if (e.value === ctx.value) return {};
      return { previousValue: ctx.value, value: e.value };
    },
    toggleOpen: (ctx: NavigationMenuContext, e: NavigationMenuEvent): Partial<NavigationMenuContext> => {
      if (e.type !== "ITEM.TOGGLE") return {};
      if (e.value === ctx.value) return { previousValue: ctx.value, value: "" };
      return { previousValue: ctx.value, value: e.value };
    },
    closeAll: (ctx: NavigationMenuContext): Partial<NavigationMenuContext> => ({
      previousValue: ctx.value,
      value: "",
    }),
  },
};
