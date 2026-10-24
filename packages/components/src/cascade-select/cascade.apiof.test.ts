import { assertEquals } from "@std/assert";
import type { CascadeApi } from "./cascade.presentation.ts";
import type { CascadeItem, CascadeLevel } from "./cascade.presentation.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
Deno.test("CascadeApi promises the component's surface", () => {
  const keys: (keyof CascadeApi)[] = [
    "state",
    "open",
    "focused",
    "multiple",
    "disabled",
    "value",
    "highlightedValue",
    "hasSelectedItems",
    "empty",
    "levels",
    "focus",
    "setOpen",
    "setHighlightValue",
    "clearHighlightValue",
    "setValue",
    "selectValue",
    "clearValue",
    "getLevels",
    "getItems",
    "getItemState",
    "getValueText",
    "getValueTextRows",
    "getRootProps",
    "getLabelProps",
    "getControlProps",
    "getTriggerProps",
    "getIndicatorProps",
    "getValueTextProps",
    "getClearTriggerProps",
    "getPositionerProps",
    "getContentProps",
    "getHiddenInputProps",
    "getListProps",
    "getItemProps",
    "getItemTextProps",
    "getItemIndicatorProps",
    "getListIndexes",
    "getItemIndexes",
    "getItemTextIndexes",
    "getItemIndicatorIndexes",
  ];
  assertEquals(keys.length, 40);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    CascadeApi["state"],
    "idle" | "focused" | "open"
  > = true;
  const setValueTyped: AssertExact<
    CascadeApi["setValue"],
    (value: readonly string[][]) => void
  > = true;
  const getItemsTyped: AssertExact<
    CascadeApi["getItems"],
    (level: CascadeLevel) => readonly CascadeItem[]
  > = true;
  assertEquals(
    [
      stateTyped,
      setValueTyped,
      getItemsTyped,
    ].every(Boolean),
    true,
  );
});
