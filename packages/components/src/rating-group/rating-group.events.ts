import type { EventUnion } from "@spinjs/runtime/fsm";

export interface RatingGroupEvents {
  "SET_VALUE": { value: number };
  "CLEAR_VALUE": {};
  "GROUP_POINTER_OVER": {};
  "GROUP_POINTER_LEAVE": { radioFocused: boolean };
  "POINTER_OVER": { index: number; isMidway: boolean };
  "FOCUS": {};
  "BLUR": {};
  "SPACE": { value: number };
  "CLICK": { value: number };
  "ARROW_LEFT": {};
  "ARROW_RIGHT": {};
  "HOME": {};
  "END": {};
  "SET_COUNT": { count: number };
}

export type RatingGroupEvent = EventUnion<RatingGroupEvents>;

export type RatingGroupValueChange = {
  readonly value: number;
};

export type RatingGroupHoverChange = {
  readonly hoveredValue: number;
};
