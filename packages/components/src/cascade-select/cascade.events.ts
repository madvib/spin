import type { EventUnion } from "@spin/runtime/fsm";

export interface CascadeEvents {
  "OPEN": {};
  "CLOSE": { restoreFocus?: boolean };
  "CONTROLLED_OPEN": {};
  "CONTROLLED_CLOSE": {};
  "TRIGGER_CLICK": {};
  "TRIGGER_FOCUS": {};
  "TRIGGER_BLUR": {};
  "TRIGGER_OPEN": { highlight: string[] };
  "ITEM_CLICK": { value: string[]; hasChildren: boolean };
  "ITEM_POINTER_ENTER": { value: string[]; hasChildren: boolean };
  "VALUE_SET": { value: string[][] | string };
  "VALUE_CLEAR": {};
  "HIGHLIGHTED_VALUE_SET": {
    value: string[];
    highlightedValue?: string | string[];
  };
  "HIGHLIGHTED_VALUE_CLEAR": {};
  "ITEM_SELECT": { value: string[]; hasChildren: boolean };
  "ITEM_CLEAR": { value: string[] };
  "CLEAR_TRIGGER_CLICK": {};
}

export type CascadeEvent = EventUnion<CascadeEvents>;
