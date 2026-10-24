import { test } from "bun:test";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
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

test("clampValue clamps and reads NaN as the lower bound", () => {
  deepStrictEqual(clampValue(5, 0, 10), 5);
  deepStrictEqual(clampValue(-5, 0, 10), 0);
  deepStrictEqual(clampValue(15, 0, 10), 10);
  deepStrictEqual(clampValue(NaN, 0, 10), 0);
});

test("getValuePercent maps a value to 0..1", () => {
  deepStrictEqual(getValuePercent(50, 0, 100), 0.5);
  deepStrictEqual(getValuePercent(0, 0, 100), 0);
});

test("getPercentValue maps a percent onto the stepped grid", () => {
  deepStrictEqual(getPercentValue(0.5, 0, 100, 1), 50);
  deepStrictEqual(getPercentValue(0.55, 0, 100, 5), 55);
});

test("snapValueToStep corrects float residue", () => {
  // 0.1 + 0.2 territory: the raw snap is 0.30000000000000004.
  strictEqual(snapValueToStep(0.30000000000000004, 0, 1, 0.1), 0.3);
});

test("snapValueToStep clamps to the largest valid step, not the max", () => {
  // 0..10 step 3: valid stops are 0,3,6,9 — 10 is not on the grid.
  strictEqual(snapValueToStep(11, 0, 10, 3), 9);
  strictEqual(snapValueToStep(-1, 0, 10, 3), 0);
});

test("getValueRanges windows each value by its neighbors plus the gap", () => {
  const ranges = getValueRanges([20, 80], 0, 100, 0);
  deepStrictEqual(ranges[0], { min: 0, max: 80, value: 20 });
  deepStrictEqual(ranges[1], { min: 20, max: 100, value: 80 });
});

test("getNextStepValue steps and clamps to neighbors", () => {
  deepStrictEqual(
    getNextStepValue(0, { values: [50], min: 0, max: 100, step: 1 }),
    [51],
  );
  deepStrictEqual(
    getNextStepValue(0, { values: [20, 80], min: 0, max: 100, step: 1 }),
    [21, 80],
  );
});

test("getPreviousStepValue steps down", () => {
  deepStrictEqual(
    getPreviousStepValue(0, { values: [50], min: 0, max: 100, step: 1 }),
    [49],
  );
});

test("closestIndex lets later thumbs win ties", () => {
  deepStrictEqual(closestIndex([20, 80], 50), 1);
  deepStrictEqual(closestIndex([20, 80], 10), 0);
});

test("round10 cleans float residue", () => {
  strictEqual(round10(0.1 + 0.2), 0.3);
});

test("isInteractive is false when read-only or disabled", () => {
  deepStrictEqual(isInteractive({ readOnly: false, disabled: false }), true);
  deepStrictEqual(isInteractive({ readOnly: true, disabled: false }), false);
  deepStrictEqual(isInteractive({ readOnly: false, disabled: true }), false);
  deepStrictEqual(isInteractive({}), true);
});
