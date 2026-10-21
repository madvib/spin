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

import { defaultTwin } from "@spin/runtime";
import { createMachine, type Machine } from "@spin/runtime/fsm";

export type NavValue = string;

export interface NavItemRecord {
  readonly value: NavValue;
  readonly label: string;
}

export interface NavigationMenuContext {
  value: NavValue;
  previousValue: NavValue;
  openDelay: number;
  closeDelay: number;
  orientation: "horizontal" | "vertical";
  disabled: boolean;
}

export interface NavigationMenuValueChange {
  readonly value: NavValue;
  readonly previousValue: NavValue;
}

export interface NavigationMenuArgs {
  value?: string;
  openDelay?: number;
  closeDelay?: number;
  orientation?: string;
  disabled?: boolean;
  defaultDisabled?: boolean;
}

const asText = (raw: unknown): string | null =>
  typeof raw === "string" ? raw : null;

export function initial(args: NavigationMenuArgs = {}, authored: (name: string) => boolean): NavigationMenuContext {
  const written = (field: string): boolean =>
    authored(field) ||
    authored(defaultTwin(field)) ||
    (args as Record<string, unknown>)[defaultTwin(field)] !== undefined;
  const count = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return {
    value: written("value") ? asText(args.value) ?? "" : "",
    previousValue: "",
    openDelay: written("openDelay") ? count(args.openDelay, 200) : 200,
    closeDelay: written("closeDelay") ? count(args.closeDelay, 300) : 300,
    orientation: written("orientation") && args.orientation === "vertical"
      ? "vertical"
      : "horizontal",
    disabled: written("disabled") ? args.disabled === true : false,
  };
}

export function startState(args: NavigationMenuArgs = {}): string {
  return (asText(args.value) ?? "").length > 0 ? "open" : "idle";
}

export type NavigationMenuEvent =
  | { type: "ITEM.ENTER"; value: NavValue }
  | { type: "ITEM.TOGGLE"; value: NavValue }
  | { type: "CLOSE" }
  | { type: "VALUE.SET"; value: NavValue };

const config = {
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
        // An enter opens after the action's open delay; a toggle opens at
        // once (a click has no dwell).
        "ITEM.ENTER": [{ target: "open", actions: [{ assign: "openFrom" }] }],
        "ITEM.TOGGLE": [{ target: "open", actions: [{ assign: "toggleOpen" }] }],
      },
    },
    open: {
      on: {
        // An enter on another item swaps at once (the dwell is skipped
        // while open). The panel's own enter cancels the pending close at
        // the action, so it needs no event here.
        "ITEM.ENTER": [{ actions: [{ assign: "swapFrom" }] }],
        "ITEM.TOGGLE": [{ target: "idle", actions: [{ assign: "toggleOpen" }] }],
        "CLOSE": [{ target: "idle", actions: [{ assign: "closeAll" }] }],
      },
    },
  },
};

const implementations = {
  conds: {},
  assigns: {
    setValue: (_ctx: NavigationMenuContext, e: NavigationMenuEvent): Partial<NavigationMenuContext> => {
      if (e.type !== "VALUE.SET") return {};
      // A write that names the value the machine already holds is not a
      // move: it leaves the previous value alone.
      const value = asText(e.value);
      if (value === null || value === _ctx.value) return {};
      return { previousValue: _ctx.value, value };
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

export function navigationMenu(
  args: NavigationMenuArgs = {},
  authored: (name: string) => boolean,
): Machine<NavigationMenuContext, NavigationMenuEvent> {
  return createMachine<NavigationMenuContext, NavigationMenuEvent>({
    ...config,
    context: initial(args, authored),
    assigns: implementations.assigns,
    conds: implementations.conds,
    /**
     * A field with an event is REPORTED: the host's write is an event,
     * the machine decides, and the change reaches the host. A field
     * without one is SILENT: the host's write lands in the field, and
     * nothing reports.
     */
    fields: {
      value: { event: "VALUE.SET" },
      openDelay: {},
      closeDelay: {},
      orientation: {},
      disabled: {},
    },
  });
}
