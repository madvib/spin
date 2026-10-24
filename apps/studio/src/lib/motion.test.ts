import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  bezierY,
  durationMs,
  easingControlPoints,
  easingUtility,
  easingValue,
} from "./motion.ts";

test("durationMs reads the ms and s forms a theme spends", () => {
  deepStrictEqual(durationMs("150ms"), 150);
  deepStrictEqual(durationMs("400ms"), 400);
  deepStrictEqual(durationMs("0.25s"), 250);
  deepStrictEqual(durationMs(" 0.0625s "), 62.5);
});

test("durationMs refuses what it cannot rank", () => {
  deepStrictEqual(durationMs("linear"), undefined);
  deepStrictEqual(durationMs("calc(1s - 200ms)"), undefined);
  deepStrictEqual(durationMs(""), undefined);
  deepStrictEqual(durationMs("-200ms"), undefined);
});

test("easingControlPoints reads the two spellings a theme has", () => {
  deepStrictEqual(easingControlPoints("linear"), [0, 0, 1, 1]);
  deepStrictEqual(easingControlPoints("cubic-bezier(0.2, 0, 0, 1)"), [
    0.2,
    0,
    0,
    1,
  ]);
  deepStrictEqual(
    easingControlPoints("cubic-bezier( 0.3 , 0 , 1 , 1 )"),
    [0.3, 0, 1, 1],
  );
});

test("easingControlPoints refuses what it cannot draw", () => {
  deepStrictEqual(easingControlPoints("ease-in-out"), undefined);
  deepStrictEqual(easingControlPoints("cubic-bezier(0.2, 0, 0)"), undefined);
  deepStrictEqual(easingControlPoints("cubic-bezier(a, b, c, d)"), undefined);
  deepStrictEqual(easingControlPoints(""), undefined);
});

test("bezierY reads the position a curve holds at a moment", () => {
  // Linear is the identity: half the time is half the progress. The solver
  // bisects, so this is a tolerance, not an exact figure.
  assert(Math.abs(bezierY([0, 0, 1, 1], 0.5) - 0.5) < 1e-4);
  // The endpoints are the endpoints for every curve.
  deepStrictEqual(bezierY([0.2, 0, 0, 1], 0), 0);
  deepStrictEqual(bezierY([0.2, 0, 0, 1], 1), 1);
});

test("bezierY puts an ease-out curve ahead of linear", () => {
  // `standard` (0.2, 0, 0, 1) spends its progress early, so at the halfway
  // mark it has already travelled past the midpoint.
  deepStrictEqual(bezierY([0.2, 0, 0, 1], 0.5) > 0.5, true);
  // `accelerate` (0.3, 0, 1, 1) spends it late, so it lags linear.
  deepStrictEqual(bezierY([0.3, 0, 1, 1], 0.5) < 0.5, true);
});

test("easingUtility names the utility an easing row plays", () => {
  deepStrictEqual(easingUtility("motion.easing.standard"), "ease-standard");
  deepStrictEqual(easingUtility("motion.easing.linear"), "ease-linear");
});

test("easingValue spells the points back the way a theme writes them", () => {
  // The identity curve round-trips to its keyword, because a document that
  // rewrites `linear` into four numbers has changed a value it did not need
  // to touch.
  deepStrictEqual(easingValue([0, 0, 1, 1]), "linear");
  deepStrictEqual(easingValue([0.2, 0, 0, 1]), "cubic-bezier(0.2, 0, 0, 1)");
  // A dragged handle lands wherever the pointer was; three decimals is the
  // precision the curve is read at, and the string stays short.
  deepStrictEqual(
    easingValue([0.3333333333, 0.6666666, 0.25, 1]),
    "cubic-bezier(0.333, 0.667, 0.25, 1)",
  );
});

test("easingValue round-trips through the points it was built from", () => {
  deepStrictEqual(
    easingControlPoints(easingValue([0.4, 0.1, 0.2, 0.9])),
    [0.4, 0.1, 0.2, 0.9],
  );
});
