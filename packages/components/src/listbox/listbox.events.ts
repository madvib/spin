import type { EventUnion } from "@spin/runtime/fsm";

export interface ListboxEvents {
  "SELECTED_ITEMS.SYNC": {};
  "HIGHLIGHTED_VALUE.SET": { value?: string | null; highlightedValue?: string | null };
  "HIGHLIGHTED_VALUE.CLEAR": {};
  "ITEM.SELECT": { value: string };
  "ITEM.CLEAR": { value: string };
  "VALUE.SET": { value: readonly string[] };
  "VALUE.CLEAR": {};
  "ITEM.CLICK": { value: string; shiftKey?: boolean; anchorValue?: string; metaKey?: boolean };
  "CONTENT.FOCUS": {};
  "CONTENT.BLUR": {};
  "CONTENT.TYPEAHEAD": { key: string };
  "ITEM.POINTER_MOVE": { value: string };
  "ITEM.POINTER_LEAVE": {};
  "NAVIGATE": { value: string; shiftKey?: boolean; anchorValue?: string; metaKey?: boolean };
}

export type ListboxEvent = EventUnion<ListboxEvents>;