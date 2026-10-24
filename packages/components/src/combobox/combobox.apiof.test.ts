import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type {
  ComboboxApi,
  ComboboxItemState,
} from "./combobox.presentation.ts";
import type { ComboboxRow } from "./combobox.state.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
test("ComboboxApi promises the component's surface", () => {
  const keys: (keyof ComboboxApi)[] = [
    "state",
    "open",
    "focused",
    "inputValue",
    "highlightedValue",
    "highlightedItem",
    "value",
    "valueAsString",
    "hasSelectedItems",
    "selectedItems",
    "multiple",
    "disabled",
    "empty",
    "syncSelectedItems",
    "setHighlightValue",
    "clearHighlightValue",
    "selectValue",
    "setValue",
    "setInputValue",
    "clearValue",
    "focus",
    "setOpen",
    "getBlocks",
    "getRows",
    "getItemState",
    "getRootProps",
    "getLabelProps",
    "getControlProps",
    "getPositionerProps",
    "getInputProps",
    "getTriggerProps",
    "getTriggerIndicatorProps",
    "getClearTriggerProps",
    "getContentProps",
    "getListProps",
    "getItemProps",
    "getItemTextProps",
    "getItemIndicatorProps",
    "getItemGroupProps",
    "getItemGroupLabelProps",
    "getItemIndexes",
    "getItemTextIndexes",
    "getItemIndicatorIndexes",
    "getItemGroupIndexes",
    "getItemGroupLabelIndexes",
  ];
  deepStrictEqual(keys.length, 45);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    ComboboxApi["state"],
    "idle" | "focused" | "interacting" | "suggesting"
  > = true;
  const setOpenTyped: AssertExact<
    ComboboxApi["setOpen"],
    (open: boolean) => void
  > = true;
  const getItemStateTyped: AssertExact<
    ComboboxApi["getItemState"],
    (row: ComboboxRow) => ComboboxItemState
  > = true;
  deepStrictEqual(
    [
      stateTyped,
      setOpenTyped,
      getItemStateTyped,
    ].every(Boolean),
    true,
  );
});
