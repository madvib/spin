import { assertEquals } from "@std/assert";
import type { PinInputApi } from "./pin-input.presentation.ts";

Deno.test("PinInputApi promises the component's surface", () => {
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
  assertEquals(keys.length, 16);
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
  assertEquals(
    [setValueTyped, setValueAtIndexTyped, getInputPropsTyped].every(Boolean),
    true,
  );
});
