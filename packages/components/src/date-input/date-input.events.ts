import type { EventUnion } from "@spin/runtime/fsm";
import type { DateValue } from "./date-input.state.ts";

export interface DateInputEvents {
  "VALUE.SET": { value: DateValue | null | string };
  "VALUE.CLEAR": {};
  "HOUR_CYCLE.SET": { hourCycle: 12 | 24 };
  "SEGMENT.FOCUS": { index: number };
  "SEGMENT.BLUR": {};
  "SEGMENT.INPUT": { index: number; input: string };
  "SEGMENT.ADJUST": { index: number; amount: number };
  "SEGMENT.ARROW_LEFT": {};
  "SEGMENT.ARROW_RIGHT": {};
  "SEGMENT.BACKSPACE": {};
  "SEGMENT.HOME": {};
  "SEGMENT.END": {};
  "SEGMENT.PASTE": { value: string };
}

export type DateInputEvent = EventUnion<DateInputEvents>;

export type DateInputValueChange = {
  readonly value: DateValue | null;
  readonly valueAsString: string;
};
