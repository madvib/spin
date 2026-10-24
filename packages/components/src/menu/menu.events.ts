import type { MenuEntry } from "./menu.state.ts";
import type { EventUnion } from "@spinjs/runtime/fsm";

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

export interface MenuOpenChange {
  readonly open: boolean;
}

export interface MenuSelect {
  readonly value: string;
}

export interface MenuHighlightChange {
  readonly highlightedValue: string | null;
}
