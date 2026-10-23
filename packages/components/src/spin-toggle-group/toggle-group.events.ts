import type { EventUnion } from "@spin/runtime/fsm";

/**
 * The toggle-group's events, as a MAP: the contract with the outside. The
 * spec's `on` map is typed over it, so a transition's KEY narrows the event
 * it receives — an assign reads its payload with no guard and no cast.
 *
 * `disabled` (and the other host fields) sync silently via `fields`, so
 * there is no SET_DISABLED event.
 */
export interface ToggleGroupEvents {
  "VALUE.SET": { value: string | readonly string[] };
  "TOGGLE.CLICK": { id: string; value: string };
  "ROOT.MOUSE_DOWN": {};
  "ROOT.FOCUS": {};
  "ROOT.BLUR": {};
  "TOGGLE.FOCUS": { id: string };
  "TOGGLE.FOCUS_NEXT": { id: string };
  "TOGGLE.FOCUS_PREV": { id: string };
  "TOGGLE.FOCUS_FIRST": { id: string };
  "TOGGLE.FOCUS_LAST": { id: string };
  "TOGGLE.SHIFT_TAB": { isShiftTab: boolean; firstId: string };
}

export type ToggleGroupEvent = EventUnion<ToggleGroupEvents>;

export type ToggleGroupValueChange = {
  readonly value: string[];
};