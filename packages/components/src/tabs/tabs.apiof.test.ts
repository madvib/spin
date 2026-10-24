import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { TabsApi } from "./tabs.presentation.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, or part from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
test("TabsApi promises the component's surface", () => {
  const keys: (keyof TabsApi)[] = [
    "state",
    "value",
    "items",
    "select",
    "getRootProps",
    "getListProps",
    "getTriggerProps",
    "getContentProps",
  ];
  deepStrictEqual(keys.length, 8);
  // Derived member signatures: state union and typed command tuples.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<TabsApi["state"], "idle" | "focused"> = true;
  const selectTyped: AssertExact<TabsApi["select"], (value: string) => void> =
    true;
  const valueTyped: AssertExact<TabsApi["value"], string> = true;
  deepStrictEqual(
    [
      stateTyped,
      selectTyped,
      valueTyped,
    ].every(Boolean),
    true,
  );
});
