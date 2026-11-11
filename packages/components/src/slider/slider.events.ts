import type { EventUnion } from "@spinjs/components/fsm";

export interface SliderEvents {
  "SET_VALUE": { value: readonly number[]; index?: number };
  "INCREMENT": { index?: number; step?: number };
  "DECREMENT": { index?: number; step?: number };
  "POINTER_DOWN": { pointValue: number };
  "THUMB_POINTER_DOWN": { index: number };
  "POINTER_MOVE": { pointValue: number };
  "POINTER_UP": {};
  "POINTER_CANCEL": {};
  "FOCUS": { index?: number };
  "BLUR": {};
  "ARROW_INC": { step?: number };
  "ARROW_DEC": { step?: number };
  "HOME": {};
  "END": {};
  // Scalar host fields (min, max, step, disabled, readOnly) sync silently via `fields`.
}

export type SliderEvent = EventUnion<SliderEvents>;

export type SliderValueChange = {
  readonly value: number[];
};

export type SliderFocusChange = {
  readonly focusedIndex: number;
  readonly value: number[];
};

export type SliderValueChangeEnd = {
  readonly value: number[];
};
