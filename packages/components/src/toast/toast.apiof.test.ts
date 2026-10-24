import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { ToastApi } from "./toast.presentation.ts";
import type { ToastEntry } from "./toast.state.ts";

// The derived api's public surface, pinned: removing a reader, method,
// command, part, or slot from the def removes it here, and this test
// names what the component promises. The def is the single source —
// this list is the contract readers check against, not a second copy.
test("ToastApi promises the component's surface", () => {
  const keys: (keyof ToastApi)[] = [
    "state",
    "count",
    "layout",
    "placement",
    "overlapping",
    "paused",
    "create",
    "update",
    "dismiss",
    "remove",
    "dismissAll",
    "pause",
    "resume",
    "getToasts",
    "getGroupProps",
    "getToastProps",
    "getTitleProps",
    "getDescriptionProps",
    "getActionTriggerProps",
    "getCloseTriggerProps",
    "getToastIndexes",
    "getTitleIndexes",
    "getDescriptionIndexes",
    "getActionTriggerIndexes",
    "getCloseTriggerIndexes",
  ];
  deepStrictEqual(keys.length, 25);
  // Derived member signatures: state union and typed methods.
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<ToastApi["state"], "stack" | "overlap"> = true;
  const dismissAllTyped: AssertExact<ToastApi["dismissAll"], () => void> = true;
  const getToastsTyped: AssertExact<
    ToastApi["getToasts"],
    () => readonly ToastEntry[]
  > = true;
  deepStrictEqual(
    [
      stateTyped,
      dismissAllTyped,
      getToastsTyped,
    ].every(Boolean),
    true,
  );
});
