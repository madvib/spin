import type { EventUnion } from "@spinjs/components/fsm";

export interface ComboboxEvents {
  "SELECTED_ITEMS.SYNC": {};
  "HIGHLIGHTED_VALUE.SET": { value: string | null; keypress?: boolean };
  "HIGHLIGHTED_VALUE.CLEAR": {};
  "ITEM.SELECT": { value: string };
  "ITEM.CLEAR": { value: string };
  "VALUE.SET": { value: readonly string[] };
  "VALUE.CLEAR": {};
  "INPUT_VALUE.SET": { value: string };
  "OPEN": {};
  "CLOSE": {};
  "INPUT.FOCUS": {};
  "INPUT.BLUR": {};
  "INPUT.CLICK": {};
  "INPUT.CHANGE": { value: string };
  "INPUT.ESCAPE": {};
  "INPUT.ENTER": {};
  "INPUT.ARROW_DOWN": { value?: string; keypress?: boolean };
  "INPUT.ARROW_UP": { value?: string; keypress?: boolean };
  "INPUT.HOME": { value?: string; keypress?: boolean };
  "INPUT.END": { value?: string; keypress?: boolean };
  "TRIGGER.CLICK": {};
  "ITEM.CLICK": { value: string };
  "ITEM.POINTER_MOVE": { value: string };
  "ITEM.POINTER_LEAVE": {};
  "LAYER.ESCAPE": {};
  "LAYER.INTERACT_OUTSIDE": {};
  "CHILDREN_CHANGE": {};
}

export type ComboboxEvent = EventUnion<ComboboxEvents>;
