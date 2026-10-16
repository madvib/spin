import { assertAlmostEquals, assertEquals } from "@std/assert";
import {
  bezierY,
  durationMs,
  easingControlPoints,
  easingUtility,
  easingValue,
} from "./motion.ts";

Deno.test("durationMs reads the ms and s forms a theme spends", () => {
  assertEquals(durationMs("150ms"), 150);
  assertEquals(durationMs("400ms"), 400);
  assertEquals(durationMs("0.25s"), 250);
  assertEquals(durationMs(" 0.0625s "), 62.5);
});

Deno.test("durationMs refuses what it cannot rank", () => {
  assertEquals(durationMs("linear"), undefined);
  assertEquals(durationMs("calc(1s - 200ms)"), undefined);
  assertEquals(durationMs(""), undefined);
  assertEquals(durationMs("-200ms"), undefined);
});

Deno.test("easingControlPoints reads the two spellings a theme has", () => {
  assertEquals(easingControlPoints("linear"), [0, 0, 1, 1]);
  assertEquals(easingControlPoints("cubic-bezier(0.2, 0, 0, 1)"), [
    0.2,
    0,
    0,
    1,
  ]);
  assertEquals(
    easingControlPoints("cubic-bezier( 0.3 , 0 , 1 , 1 )"),
    [0.3, 0, 1, 1],
  );
});

Deno.test("easingControlPoints refuses what it cannot draw", () => {
  assertEquals(easingControlPoints("ease-in-out"), undefined);
  assertEquals(easingControlPoints("cubic-bezier(0.2, 0, 0)"), undefined);
  assertEquals(easingControlPoints("cubic-bezier(a, b, c, d)"), undefined);
  assertEquals(easingControlPoints(""), undefined);
});

Deno.test("bezierY reads the position a curve holds at a moment", () => {
  // Linear is the identity: half the time is half the progress. The solver
  // bisects, so this is a tolerance, not an exact figure.
  assertAlmostEquals(bezierY([0, 0, 1, 1], 0.5), 0.5, 1e-4);
  // The endpoints are the endpoints for every curve.
  assertEquals(bezierY([0.2, 0, 0, 1], 0), 0);
  assertEquals(bezierY([0.2, 0, 0, 1], 1), 1);
});

Deno.test("bezierY puts an ease-out curve ahead of linear", () => {
  // `standard` (0.2, 0, 0, 1) spends its progress early, so at the halfway
  // mark it has already travelled past the midpoint.
  assertEquals(bezierY([0.2, 0, 0, 1], 0.5) > 0.5, true);
  // `accelerate` (0.3, 0, 1, 1) spends it late, so it lags linear.
  assertEquals(bezierY([0.3, 0, 1, 1], 0.5) < 0.5, true);
});

Deno.test("easingUtility names the utility an easing row plays", () => {
  assertEquals(easingUtility("motion.easing.standard"), "ease-standard");
  assertEquals(easingUtility("motion.easing.linear"), "ease-linear");
});

Deno.test("easingValue spells the points back the way a theme writes them", () => {
  // The identity curve round-trips to its keyword, because a document that
  // rewrites `linear` into four numbers has changed a value it did not need
  // to touch.
  assertEquals(easingValue([0, 0, 1, 1]), "linear");
  assertEquals(easingValue([0.2, 0, 0, 1]), "cubic-bezier(0.2, 0, 0, 1)");
  // A dragged handle lands wherever the pointer was; three decimals is the
  // precision the curve is read at, and the string stays short.
  assertEquals(
    easingValue([0.3333333333, 0.6666666, 0.25, 1]),
    "cubic-bezier(0.333, 0.667, 0.25, 1)",
  );
});

Deno.test("easingValue round-trips through the points it was built from", () => {
  assertEquals(
    easingControlPoints(easingValue([0.4, 0.1, 0.2, 0.9])),
    [0.4, 0.1, 0.2, 0.9],
  );
});
