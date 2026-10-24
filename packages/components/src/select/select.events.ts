export interface SelectEvents {
  "SELECTED_ITEMS.SYNC": {};
  "HIGHLIGHTED_VALUE.SET": { highlightedValue: string | null };
  "HIGHLIGHTED_VALUE.CLEAR": {};
  "ITEM.SELECT": { value: string };
  "ITEM.CLEAR": { value: string };
  "VALUE.SET": { value: readonly string[] };
  "VALUE.CLEAR": {};
  "CLEAR.CLICK": {};
  "OPEN": {};
  "CLOSE": {};
  "TOGGLE": {};
  "CONTROLLED.OPEN": {};
  "CONTROLLED.CLOSE": { restoreFocus?: boolean };
  "TRIGGER.CLICK": {};
  "TRIGGER.FOCUS": {};
  "TRIGGER.BLUR": {};
  "TRIGGER.ENTER": {};
  "TRIGGER.ARROW_UP": {};
  "TRIGGER.ARROW_DOWN": {};
  "TRIGGER.ARROW_LEFT": {};
  "TRIGGER.ARROW_RIGHT": {};
  "TRIGGER.HOME": {};
  "TRIGGER.END": {};
  "TRIGGER.TYPEAHEAD": { value: string };
  "ITEM.CLICK": { value: string };
  "ITEM.POINTER_MOVE": { value: string };
  "ITEM.POINTER_LEAVE": {};
  "CONTENT.HOME": {};
  "CONTENT.END": {};
  "CONTENT.ARROW_UP": {};
  "CONTENT.ARROW_DOWN": {};
  "CONTENT.TYPEAHEAD": { value: string };
  "LAYER.ESCAPE": {};
  "LAYER.INTERACT_OUTSIDE": { restoreFocus?: boolean };
}

import type { EventUnion } from "@spin/runtime/fsm";
export type SelectEvent = EventUnion<SelectEvents>;
