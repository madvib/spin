import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { SelectApi, SelectItemState } from "./select.presentation.ts";
import type { SelectRow } from "./select.state.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
test("SelectApi promises the component's surface", () => {
  const keys: (keyof SelectApi)[] = [
    "state",
    "open",
    "focused",
    "value",
    "valueAsString",
    "hasSelectedItems",
    "highlightedValue",
    "highlightedItem",
    "selectedItems",
    "multiple",
    "disabled",
    "empty",
    "syncSelectedItems",
    "selectValue",
    "setValue",
    "clearValue",
    "setHighlightValue",
    "clearHighlightValue",
    "setOpen",
    "close",
    "toggle",
    "focus",
    "getRows",
    "getSelectedRows",
    "getItemState",
    "getRootProps",
    "getLabelProps",
    "getControlProps",
    "getTriggerProps",
    "getTriggerIndicatorProps",
    "getClearTriggerProps",
    "getValueTextProps",
    "getPositionerProps",
    "getContentProps",
    "getListProps",
    "getHiddenSelectProps",
    "getItemProps",
    "getItemTextProps",
    "getItemIndicatorProps",
    "getItemIndexes",
    "getItemTextIndexes",
    "getItemIndicatorIndexes",
  ];
  deepStrictEqual(keys.length, 42);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    SelectApi["state"],
    "idle" | "focused" | "open"
  > = true;
  const setValueTyped: AssertExact<
    SelectApi["setValue"],
    (value: readonly string[]) => void
  > = true;
  const setOpenTyped: AssertExact<
    SelectApi["setOpen"],
    (open: boolean) => void
  > = true;
  const getItemStateTyped: AssertExact<
    SelectApi["getItemState"],
    (row: SelectRow) => SelectItemState
  > = true;
  deepStrictEqual(
    [
      stateTyped,
      setValueTyped,
      setOpenTyped,
      getItemStateTyped,
    ].every(Boolean),
    true,
  );
});
