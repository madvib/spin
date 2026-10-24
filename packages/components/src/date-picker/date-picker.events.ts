import type { EventUnion } from "@spinjs/runtime/fsm";
import type { DatePickerValue, DatePickerView } from "./date-picker.state.ts";

export interface DatePickerValueChange {
  readonly value: readonly DatePickerValue[];
  readonly valueAsString: readonly string[];
}

export interface DatePickerFocusChange {
  readonly focusedValue: DatePickerValue;
  readonly view: DatePickerView;
  readonly valueAsString: readonly string[];
}

export interface DatePickerViewChange {
  readonly view: DatePickerView;
}

export interface DatePickerEvents {
  "OPEN": {};
  "CLOSE": {};
  "CLOSE.OUTSIDE": {};
  "VALUE.SET": { value: readonly DatePickerValue[] | string };
  "VALUE.CLEAR": {};
  "FOCUS.SET": { focusedValue: DatePickerValue | string };
  "VIEW.SET": { view: DatePickerView };
  "CELL.CLICK": { value: DatePickerValue };
  "CELL.POINTER_MOVE": { value: DatePickerValue };
  "TABLE.POINTER_LEAVE": {};
  "TABLE.ENTER": { value: DatePickerValue };
  "TABLE.ESCAPE": {};
}

export type DatePickerEvent = EventUnion<DatePickerEvents>;
