import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { PinInputApi } from "./pin-input.presentation.ts";

test("PinInputApi promises the component's surface", () => {
  const keys: (keyof PinInputApi)[] = [
    "focus",
    "setValue",
    "clearValue",
    "setValueAtIndex",
    "count",
    "items",
    "value",
    "valueAsString",
    "complete",
    "focused",
    "getRootProps",
    "getLabelProps",
    "getControlProps",
    "getHiddenInputProps",
    "getInputProps",
    "getItems",
  ];
  deepStrictEqual(keys.length, 16);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const setValueTyped: AssertExact<
    PinInputApi["setValue"],
    (value: readonly string[]) => void
  > = true;
  const setValueAtIndexTyped: AssertExact<
    PinInputApi["setValueAtIndex"],
    (index: number, value: string) => void
  > = true;
  const getInputPropsTyped: AssertExact<
    PinInputApi["getInputProps"],
    (index: number) => Record<string, unknown>
  > = true;
  deepStrictEqual(
    [setValueTyped, setValueAtIndexTyped, getInputPropsTyped].every(Boolean),
    true,
  );
});
