/** Navigation-menu machine: the closed and open modes. */

import { createMachine, type Machine } from "@spin/runtime/fsm";
import { initial, type NavigationMenuArgs, type NavigationMenuContext, type NavigationMenuState } from "./navigation-menu.state.ts";
import type { NavigationMenuEvents } from "./navigation-menu.events.ts";
import { closeAll, openItem, setValue, swapItem, toggleOpen } from "./navigation-menu.transitions.ts";

export { type NavigationMenuArgs, type NavigationMenuContext, type NavigationMenuState } from "./navigation-menu.state.ts";
export { type NavigationMenuEvents, type NavigationMenuEvent, type NavigationMenuValueChange } from "./navigation-menu.events.ts";
export type { NavValue, NavItemRecord } from "./navigation-menu.state.ts";

export function navigationMenu(
  args: NavigationMenuArgs = {},
  authored: (name: string) => boolean,
): Machine<NavigationMenuContext, NavigationMenuEvents, NavigationMenuState> {
  return createMachine<NavigationMenuContext, NavigationMenuEvents, NavigationMenuState>({
    id: "navigation-menu",
    initial: "idle",
    context: initial(args, authored),
    fields: {
      value: { event: "VALUE.SET" },
      previousValue: {},
      openDelay: {},
      closeDelay: {},
      orientation: {},
      disabled: {},
      items: {},
    },
    on: {
      "VALUE.SET": [{ assign: setValue }],
      "CLOSE": [{ assign: closeAll }],
    },
    states: {
      idle: {
        on: {
          "ITEM.ENTER": [{ target: "open", assign: openItem }],
          "ITEM.TOGGLE": [{ target: "open", assign: toggleOpen }],
        },
      },
      open: {
        on: {
          "ITEM.ENTER": [{ assign: swapItem }],
          "ITEM.TOGGLE": [{ target: "idle", assign: toggleOpen }],
          "CLOSE": [{ target: "idle", assign: closeAll }],
        },
      },
    },
  });
}