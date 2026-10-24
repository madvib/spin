import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { RatingGroupApi } from "./rating-group.presentation.ts";

test("RatingGroupApi promises the component's surface", () => {
  const keys: (keyof RatingGroupApi)[] = [
    "state",
    "value",
    "hoveredValue",
    "hovering",
    "count",
    "setValue",
    "clearValue",
    "getItems",
    "getItemState",
    "getRootProps",
    "getLabelProps",
    "getControlProps",
    "getItemProps",
    "getHiddenInputProps",
  ];
  deepStrictEqual(keys.length, 14);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    RatingGroupApi["state"],
    "idle" | "focus" | "hover"
  > = true;
  const setValueTyped: AssertExact<
    RatingGroupApi["setValue"],
    (value: number) => void
  > = true;
  const getItemPropsTyped: AssertExact<
    RatingGroupApi["getItemProps"],
    (index: number) => Record<string, unknown>
  > = true;
  const getItemStateTyped: AssertExact<
    RatingGroupApi["getItemState"],
    (
      index: number,
    ) => {
      readonly highlighted: boolean;
      readonly half: boolean;
      readonly checked: boolean;
    }
  > = true;
  deepStrictEqual(
    [stateTyped, setValueTyped, getItemPropsTyped, getItemStateTyped].every(
      Boolean,
    ),
    true,
  );
});
