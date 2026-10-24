import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { TagsApi } from "./tags.presentation.ts";
import type { TagsRow } from "./tags.presentation.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
test("TagsApi promises the component's surface", () => {
  const keys: (keyof TagsApi)[] = [
    "state",
    "value",
    "inputValue",
    "valueAsString",
    "count",
    "empty",
    "atMax",
    "highlightedIndex",
    "editing",
    "editedIndex",
    "setValue",
    "addValue",
    "setValueAtIndex",
    "clearValue",
    "setInputValue",
    "clearInputValue",
    "focus",
    "getTags",
    "getItemState",
    "indexOfRow",
    "indexOfId",
    "announceLog",
    "getRootProps",
    "getLabelProps",
    "getControlProps",
    "getInputProps",
    "getHiddenInputProps",
    "getClearTriggerProps",
    "getLiveRegionProps",
    "getItemProps",
    "getItemPreviewProps",
    "getItemTextProps",
    "getItemInputProps",
    "getItemDeleteTriggerProps",
    "getItemIndexes",
    "getItemPreviewIndexes",
    "getItemTextIndexes",
    "getItemInputIndexes",
    "getItemDeleteTriggerIndexes",
  ];
  deepStrictEqual(keys.length, 39);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    TagsApi["state"],
    "idle" | "focused:input" | "navigating:tag" | "editing:tag"
  > = true;
  const setValueTyped: AssertExact<
    TagsApi["setValue"],
    (value: readonly string[]) => void
  > = true;
  const indexOfRowTyped: AssertExact<
    TagsApi["indexOfRow"],
    (row: TagsRow) => number
  > = true;
  deepStrictEqual(
    [
      stateTyped,
      setValueTyped,
      indexOfRowTyped,
    ].every(Boolean),
    true,
  );
});
