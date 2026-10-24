import type { EventUnion } from "@spinjs/runtime/fsm";

export interface NumberInputEvents {
  "VALUE.SET": { value: number | string };
  "VALUE.CLEAR": {};
  "VALUE.INCREMENT": {};
  "VALUE.DECREMENT": {};
  "TRIGGER.PRESS_DOWN": { hint: NumberInputHint };
  "TRIGGER.PRESS_UP": {};
  "CHANGE_DELAY": {};
  "SPIN": {};
  "SCRUBBER.PRESS_DOWN": { point: NumberInputPoint };
  "SCRUBBER.POINTER_MOVE": { hint: NumberInputHint; point: NumberInputPoint };
  "SCRUBBER.POINTER_UP": {};
  "INPUT.FOCUS": {};
  "INPUT.BLUR": {};
  "INPUT.CHANGE": { value: string };
  "INPUT.ARROW_UP": { step: number };
  "INPUT.ARROW_DOWN": { step: number };
  "INPUT.HOME": {};
  "INPUT.END": {};
  "INPUT.ENTER": {};
  "FIELDSET.DISABLED": { value: boolean };
}

export type NumberInputHint = "increment" | "decrement";

export interface NumberInputPoint {
  readonly x: number;
  readonly y: number;
}

export type NumberInputEvent = EventUnion<NumberInputEvents>;

export interface NumberInputValueChange {
  readonly value: string;
  readonly valueAsNumber: number;
}

export interface NumberInputValueCommit {
  readonly value: string;
  readonly valueAsNumber: number;
}

export type NumberInputInvalidReason = "rangeOverflow" | "rangeUnderflow";

export interface NumberInputValueInvalid {
  readonly reason: NumberInputInvalidReason;
  readonly value: string;
  readonly valueAsNumber: number;
}

export interface NumberInputFocusChange {
  readonly focused: boolean;
  readonly value: string;
  readonly valueAsNumber: number;
}
