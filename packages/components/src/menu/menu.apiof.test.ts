import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { MenuApi } from "./menu.presentation.ts";
import type { MenuBlock, MenuRow } from "./menu.state.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
test("MenuApi promises the component's surface", () => {
  const keys: (keyof MenuApi)[] = [
    "state",
    "isOpen",
    "highlightedValue",
    "open",
    "close",
    "setHighlighted",
    "getBlocks",
    "getRows",
    "getTriggerProps",
    "getTriggerIndicatorProps",
    "getContextTriggerProps",
    "getPositionerProps",
    "getContentProps",
    "getItemGroupProps",
    "getItemGroupLabelProps",
    "getItemProps",
    "getItemTextProps",
    "getItemIndicatorProps",
    "getItemShortcutProps",
    "getItemSubmenuIndicatorProps",
    "getSeparatorProps",
    "getSubmenuProps",
    "getItemGroupIndexes",
    "getItemGroupLabelIndexes",
    "getItemIndexes",
    "getItemTextIndexes",
    "getItemIndicatorIndexes",
    "getItemShortcutIndexes",
    "getItemSubmenuIndicatorIndexes",
    "getSeparatorIndexes",
    "getSubmenuIndexes",
  ];
  deepStrictEqual(keys.length, 31);
  // Derived member signatures: state union, typed command tuples, typed
  // methods, and typed slot parameter records.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<MenuApi["state"], "closed" | "open"> = true;
  const setHighlightedTyped: AssertExact<
    MenuApi["setHighlighted"],
    (value: string | null) => void
  > = true;
  const getRowsTyped: AssertExact<
    MenuApi["getRows"],
    (block: MenuBlock) => readonly MenuRow[]
  > = true;
  deepStrictEqual(
    [
      stateTyped,
      setHighlightedTyped,
      getRowsTyped,
    ].every(Boolean),
    true,
  );
});
