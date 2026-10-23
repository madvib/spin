import type { EventUnion } from "@spin/runtime/fsm";

export interface TagsEvents {
  "FOCUS": {};
  "POINTER_DOWN": {};
  "TYPE": { value: string };
  "BLUR": {};
  "ENTER": {};
  "DELIMITER_KEY": {};
  "ARROW_LEFT": { caretAtStart: boolean };
  "ARROW_RIGHT": { caretAtStart: boolean };
  "ARROW_DOWN": {};
  "ESCAPE": {};
  "BACKSPACE": { caretAtStart: boolean };
  "DELETE": { caretAtStart: boolean };
  "PASTE": { value: string };
  "DOUBLE_CLICK_TAG": { index: number };
  "POINTER_DOWN_TAG": { index: number };
  "CLICK_DELETE_TAG": { index: number };
  "SET_INPUT_VALUE": { value: string };
  "SET_VALUE": { value: readonly string[] };
  "SET_VALUE_AT_INDEX": { index: number; value: string };
  "CLEAR_TAG": { index: number };
  "CLEAR_VALUE": {};
  "ADD_TAG": { value?: string };
  "EXTERNAL_BLUR": {};
  "TAG_INPUT_TYPE": { value: string };
  "TAG_INPUT_ESCAPE": {};
  "TAG_INPUT_BLUR": { relatedToInput: boolean };
  "TAG_INPUT_ENTER": {};
}

export type TagsEvent = EventUnion<TagsEvents>;

export interface TagsValueChange {
  readonly value: readonly string[];
}

export interface TagsInputValueChange {
  readonly inputValue: string;
}

export interface TagsHighlightChange {
  readonly highlightedValue: number | null;
}

export interface TagsValueInvalid {
  readonly reason: "invalidTag" | "rangeOverflow";
}