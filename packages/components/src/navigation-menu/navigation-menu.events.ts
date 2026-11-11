import type { EventUnion } from "@spinjs/components/fsm";
import type { NavValue } from "./navigation-menu.state.ts";

export interface NavigationMenuEvents {
  "ITEM.ENTER": { value: NavValue };
  "ITEM.TOGGLE": { value: NavValue };
  "CLOSE": {};
  "VALUE.SET": { value: NavValue };
}

export type NavigationMenuEvent = EventUnion<NavigationMenuEvents>;

export interface NavigationMenuValueChange {
  readonly value: NavValue;
  readonly previousValue: NavValue;
}
