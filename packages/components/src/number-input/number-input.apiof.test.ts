import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import type { NumberInputApi } from "./number-input.presentation.ts";

test("NumberInputApi promises the component's surface", () => {
  const keys: (keyof NumberInputApi)[] = [
    "state",
    "value",
    "valueAsNumber",
    "focused",
    "scrubbing",
    "invalid",
    "disabled",
    "empty",
    "canIncrement",
    "canDecrement",
    "required",
    "setValue",
    "clearValue",
    "increment",
    "decrement",
    "setToMax",
    "setToMin",
    "focus",
    "getRootProps",
    "getLabelProps",
    "getControlProps",
    "getValueTextProps",
    "getInputProps",
    "getDecrementTriggerProps",
    "getIncrementTriggerProps",
    "getScrubberProps",
    "getCursorProps",
  ];
  deepStrictEqual(keys.length, 27);
  type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false)
    : false;
  const stateTyped: AssertExact<
    NumberInputApi["state"],
    "idle" | "focused" | "scrubbing"
  > = true;
  const setValueTyped: AssertExact<
    NumberInputApi["setValue"],
    (value: number | string) => void
  > = true;
  const incrementTyped: AssertExact<NumberInputApi["increment"], () => void> =
    true;
  const focusTyped: AssertExact<NumberInputApi["focus"], () => void> = true;
  deepStrictEqual(
    [stateTyped, setValueTyped, incrementTyped, focusTyped].every(Boolean),
    true,
  );
});
