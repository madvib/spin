import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { ToggleGroupApi } from "./toggle-group.presentation.ts";

test("ToggleGroupApi promises the component's surface", () => {
  const keys: (keyof ToggleGroupApi)[] = [
    "state",
    "value",
    "multiple",
    "isPressed",
    "getItemState",
    "getItems",
    "setValue",
    "getRootProps",
    "getItemProps",
  ];
  deepStrictEqual(keys.length, 9);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<ToggleGroupApi["state"], "idle" | "focused"> =
    true;
  const setValueTyped: AssertExact<
    ToggleGroupApi["setValue"],
    (value: readonly string[]) => void
  > = true;
  const isPressedTyped: AssertExact<
    ToggleGroupApi["isPressed"],
    (value: string) => boolean
  > = true;
  const getItemPropsTyped: AssertExact<
    ToggleGroupApi["getItemProps"],
    (
      slot: { value: string; label: string; disabled?: boolean },
    ) => Record<string, unknown>
  > = true;
  deepStrictEqual(
    [stateTyped, setValueTyped, isPressedTyped, getItemPropsTyped].every(
      Boolean,
    ),
    true,
  );
});
