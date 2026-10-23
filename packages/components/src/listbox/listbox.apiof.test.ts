import { assertEquals } from "@std/assert";
import type { ListboxApi } from "./listbox.presentation.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
Deno.test("ListboxApi promises the component's surface", () => {
  const keys: (keyof ListboxApi)[] = [
    "state",
    "focused",
    "highlightedValue",
    "highlightedItem",
    "value",
    "valueAsString",
    "hasSelectedItems",
    "selectedItems",
    "multiple",
    "disabled",
    "empty",
    "orientation",
    "syncSelectedItems",
    "setHighlightValue",
    "clearHighlightValue",
    "selectValue",
    "setValue",
    "selectAll",
    "clearValue",
    "highlightFirst",
    "highlightLast",
    "highlightNext",
    "highlightPrevious",
    "getBlocks",
    "getRows",
    "getItemState",
    "getRootProps",
    "getLabelProps",
    "getValueTextProps",
    "getContentProps",
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
  assertEquals(keys.length, 40);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
  const stateTyped: AssertExact<ListboxApi["state"], "idle"> = true;
  const setValueTyped: AssertExact<ListboxApi["setValue"], (value: readonly string[]) => void> = true;
  const clearValueTyped: AssertExact<ListboxApi["clearValue"], (value?: string) => void> = true;
  const valueTyped: AssertExact<ListboxApi["value"], string[]> = true;
  assertEquals(
    [
      stateTyped,
      setValueTyped,
      clearValueTyped,
      valueTyped,
    ].every(Boolean),
    true,
  );
});
