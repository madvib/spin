import type { EventUnion } from "@spin/runtime/fsm";

export interface SliderEvents {
  "SET_VALUE": { value: readonly number[]; index?: number };
  "INCREMENT": { index?: number; step?: number };
  "DECREMENT": { index?: number; step?: number };
  "POINTER_DOWN": { pointValue: number };
  "THUMB_POINTER_DOWN": { index: number; offset?: number };
  "POINTER_MOVE": { pointValue: number };
  "POINTER_UP": {};
  "POINTER_CANCEL": {};
  "FOCUS": { index?: number };
  "BLUR": {};
  "ARROW_INC": { step?: number };
  "ARROW_DEC": { step?: number };
  "HOME": {};
  "END": {};
  "SET_MIN": { min: number };
  "SET_MAX": { max: number };
  "SET_STEP": { step: number };
  "SET_DISABLED": { disabled: boolean };
  "SET_READ_ONLY": { readOnly: boolean };
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
