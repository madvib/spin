import { assertEquals, assertStrictEquals } from "@std/assert";
import {
  clampValue,
  closestIndex,
  getNextStepValue,
  getPercentValue,
  getPreviousStepValue,
  getValuePercent,
  getValueRanges,
  isInteractive,
  round10,
  snapValueToStep,
} from "./numbers.ts";

Deno.test("clampValue clamps and reads NaN as the lower bound", () => {
  assertEquals(clampValue(5, 0, 10), 5);
  assertEquals(clampValue(-5, 0, 10), 0);
  assertEquals(clampValue(15, 0, 10), 10);
  assertEquals(clampValue(NaN, 0, 10), 0);
});

Deno.test("getValuePercent maps a value to 0..1", () => {
  assertEquals(getValuePercent(50, 0, 100), 0.5);
  assertEquals(getValuePercent(0, 0, 100), 0);
});

Deno.test("getPercentValue maps a percent onto the stepped grid", () => {
  assertEquals(getPercentValue(0.5, 0, 100, 1), 50);
  assertEquals(getPercentValue(0.55, 0, 100, 5), 55);
});

Deno.test("snapValueToStep corrects float residue", () => {
  // 0.1 + 0.2 territory: the raw snap is 0.30000000000000004.
  assertStrictEquals(snapValueToStep(0.30000000000000004, 0, 1, 0.1), 0.3);
});

Deno.test("snapValueToStep clamps to the largest valid step, not the max", () => {
  // 0..10 step 3: valid stops are 0,3,6,9 — 10 is not on the grid.
  assertStrictEquals(snapValueToStep(11, 0, 10, 3), 9);
  assertStrictEquals(snapValueToStep(-1, 0, 10, 3), 0);
});

Deno.test("getValueRanges windows each value by its neighbors plus the gap", () => {
  const ranges = getValueRanges([20, 80], 0, 100, 0);
  assertEquals(ranges[0], { min: 0, max: 80, value: 20 });
  assertEquals(ranges[1], { min: 20, max: 100, value: 80 });
});

Deno.test("getNextStepValue steps and clamps to neighbors", () => {
  assertEquals(getNextStepValue(0, { values: [50], min: 0, max: 100, step: 1 }), [51]);
  assertEquals(getNextStepValue(0, { values: [20, 80], min: 0, max: 100, step: 1 }), [21, 80]);
});

Deno.test("getPreviousStepValue steps down", () => {
  assertEquals(getPreviousStepValue(0, { values: [50], min: 0, max: 100, step: 1 }), [49]);
});

Deno.test("closestIndex lets later thumbs win ties", () => {
  assertEquals(closestIndex([20, 80], 50), 1);
  assertEquals(closestIndex([20, 80], 10), 0);
});

Deno.test("round10 cleans float residue", () => {
  assertStrictEquals(round10(0.1 + 0.2), 0.3);
});

Deno.test("isInteractive is false when read-only or disabled", () => {
  assertEquals(isInteractive({ readOnly: false, disabled: false }), true);
  assertEquals(isInteractive({ readOnly: true, disabled: false }), false);
  assertEquals(isInteractive({ readOnly: false, disabled: true }), false);
  assertEquals(isInteractive({}), true);
});
