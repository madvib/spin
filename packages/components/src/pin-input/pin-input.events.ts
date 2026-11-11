import type { EventUnion } from "@spinjs/components/fsm";

export interface PinInputEvents {
  "VALUE.SET": { value: readonly string[]; index?: undefined } | {
    value: string;
    index: number;
  };
  "VALUE.CLEAR": {};
  "INPUT.FOCUS": { index: number };
  "INPUT.BLUR": { index: number };
  "INPUT.CHANGE": { index: number; value: string };
  "INPUT.PASTE": { value: string };
  "INPUT.ADVANCE": {};
  "INPUT.BACKSPACE": {};
  "INPUT.DELETE": {};
  "INPUT.ARROW_LEFT": {};
  "INPUT.ARROW_RIGHT": {};
  "INPUT.HOME": {};
  "INPUT.END": {};
  "VALUE.INVALID": { value: string };
}

export type PinInputEvent = EventUnion<PinInputEvents>;

export interface PinInputValueChange {
  readonly value: string[];
  readonly valueAsString: string;
}

export interface PinInputValueComplete {
  readonly value: string[];
  readonly valueAsString: string;
}

export interface PinInputValueInvalid {
  readonly value: string;
  readonly index: number;
}
