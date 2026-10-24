import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import {
  lockstepEdits,
  measure,
  quantize,
  robustMax,
  scaleValue,
  sliderRange,
} from "./scale.ts";

test("measure reads the shapes a theme's numbers come in", () => {
  deepStrictEqual(measure("150ms"), { kind: "duration", n: 150, unit: "ms" });
  deepStrictEqual(measure("0.25s"), { kind: "duration", n: 0.25, unit: "s" });
  deepStrictEqual(measure("0.25rem"), { kind: "length", n: 0.25, unit: "rem" });
  deepStrictEqual(measure("9999px"), { kind: "length", n: 9999, unit: "px" });
  deepStrictEqual(measure("0"), { kind: "number", n: 0, unit: "" });
  deepStrictEqual(measure("1000"), { kind: "number", n: 1000, unit: "" });
  deepStrictEqual(measure("50%"), { kind: "length", n: 50, unit: "%" });
});

test("measure refuses what no slider can step through", () => {
  deepStrictEqual(measure("#3f3f46"), undefined);
  deepStrictEqual(measure("linear"), undefined);
  deepStrictEqual(measure("cubic-bezier(0.2, 0, 0, 1)"), undefined);
  deepStrictEqual(measure("0 1px 3px rgb(0 0 0 / 0.1)"), undefined);
  deepStrictEqual(measure("ui-sans-serif, system-ui"), undefined);
  deepStrictEqual(measure("calc(1s - 200ms)"), undefined);
});

test("scaleValue scales in the unit the theme authored", () => {
  deepStrictEqual(scaleValue("0.25rem", 2), "0.5rem");
  deepStrictEqual(scaleValue("0.0625rem", 4), "0.25rem");
  deepStrictEqual(scaleValue("150ms", 1.2), "180ms");
  deepStrictEqual(scaleValue("0.25s", 2), "0.5s");
  deepStrictEqual(scaleValue("8px", 1.5), "12px");
  deepStrictEqual(scaleValue("0", 2), "0");
  deepStrictEqual(scaleValue("1000", 1.25), "1250");
  deepStrictEqual(scaleValue("9999px", 2), "19998px");
});

test("scaleValue keeps the precision the author wrote", () => {
  // A value the author authored to a tenth stays to a tenth: the factor is
  // a nudge on their number, not a licence to invent decimals.
  deepStrictEqual(scaleValue("0.5", 1.4), "0.7");
  deepStrictEqual(scaleValue("0.5rem", 1.5), "0.75rem");
  // The spacing scale is a sixteenth grid, and a scaled step stays on it —
  // a nudge that would land between steps snaps back rather than inventing
  // a value the scale never had.
  deepStrictEqual(scaleValue("1rem", 1.001), "1rem");
  deepStrictEqual(scaleValue("1rem", 1.02), "1.02rem");
});

test("scaleValue refuses what a factor cannot mean", () => {
  deepStrictEqual(scaleValue("#3f3f46", 2), undefined);
  deepStrictEqual(scaleValue("linear", 2), undefined);
  deepStrictEqual(scaleValue("cubic-bezier(0.2, 0, 0, 1)", 2), undefined);
  deepStrictEqual(scaleValue("0 1px 3px rgb(0 0 0 / 0.1)", 2), undefined);
});

test("quantize lands a proposed number back on the theme's grid", () => {
  deepStrictEqual(quantize("0.0625rem", 0.07), "0.0625rem");
  deepStrictEqual(quantize("8px", 8.6), "9px");
  deepStrictEqual(quantize("150ms", 152), "152ms");
  deepStrictEqual(quantize("0.5px", 0.54), "0.5px");
  deepStrictEqual(quantize("1000", 1000.4), "1000");
});

test("robustMax reads the top of a ramp without being fooled by an outlier", () => {
  deepStrictEqual(robustMax([0, 4, 8, 16, 32, 64]), 64);
  deepStrictEqual(robustMax([150, 250, 400]), 400);
  deepStrictEqual(robustMax([14, 18, 24]), 24);
  deepStrictEqual(robustMax([1000, 2000, 3000]), 3000);
  // `radius.full` is a pill, not the top of the scale: a value this far
  // above the rest would pin every other slider at zero.
  deepStrictEqual(robustMax([0, 2, 4, 8, 9999]), 8);
});

test("robustMax answers an empty or flat group without lying", () => {
  deepStrictEqual(robustMax([]), 0);
  deepStrictEqual(robustMax([0]), 0);
  deepStrictEqual(robustMax([0, 0]), 0);
  // Two values, the lower of them zero: there is nothing to be an outlier
  // against, so the value stands.
  deepStrictEqual(robustMax([0, 8]), 8);
});

test("sliderRange gives every step of a group the same ceiling", () => {
  const steps = ["0", "0.25rem", "0.5rem", "1rem", "2rem", "4rem"];
  // The ramp's ceiling: twice the top, in this row's own unit, stepping on
  // the sixteenth grid the scale is authored in.
  deepStrictEqual(sliderRange("0.25rem", steps), {
    min: 0,
    max: 8,
    step: 0.015625,
  });
  deepStrictEqual(sliderRange("4rem", steps), { min: 0, max: 8, step: 0.08 });
  const durations = ["150ms", "250ms", "400ms"];
  deepStrictEqual(sliderRange("150ms", durations), { min: 0, max: 800, step: 1 });
  deepStrictEqual(sliderRange("1000", ["0", "1000", "2000", "3000"]), {
    min: 0,
    max: 6000,
    step: 1,
  });
});

test("sliderRange lets a row above the ramp take its own headroom", () => {
  const radii = ["0", "0.125rem", "0.25rem", "0.5rem", "9999px"];
  // The pill does not drag the rest of the scale's ceiling up with it…
  deepStrictEqual(sliderRange("0.5rem", radii), {
    min: 0,
    max: 1,
    step: 0.015625,
  });
  // …and it still has room to grow.
  deepStrictEqual(sliderRange("9999px", radii), {
    min: 0,
    max: 19998,
    step: 1,
  });
});

test("sliderRange converts the ceiling into the row's own unit", () => {
  deepStrictEqual(sliderRange("0.25s", ["0.25s", "0.4s"]), {
    min: 0,
    max: 0.8,
    step: 0.001,
  });
});

test("sliderRange never hands back a dead track", () => {
  deepStrictEqual(sliderRange("0", ["0", "0"]), { min: 0, max: 16, step: 1 });
  deepStrictEqual(sliderRange("0ms", ["0ms"]), { min: 0, max: 400, step: 1 });
  deepStrictEqual(sliderRange("0rem", ["0rem"]), {
    min: 0,
    max: 1,
    step: 0.015625,
  });
});

test("sliderRange gives a value below zero room on both sides", () => {
  // A tracking token is authored in hundredths of an em. Without a floor
  // below zero the thumb pinned at the track's left edge and the drag could
  // only climb away from the authored value.
  deepStrictEqual(sliderRange("-0.01em", ["-0.01em"]), {
    min: -0.02,
    max: 0.02,
    step: 0.0002,
  });
  // A family with a positive step keeps that ceiling; the negative row's
  // floor stays its own.
  deepStrictEqual(sliderRange("-0.01em", ["-0.01em", "0.05em"]), {
    min: -0.02,
    max: 0.1,
    step: 0.0002,
  });
});

test("sliderRange steps an em on its own magnitude, not a layout floor", () => {
  // A tracking value is smaller than a sixteenth of an em; the old floor
  // landed coarser than the value itself, and the thumb could only sit near
  // its own number. The magnitude is the grid.
  deepStrictEqual(sliderRange("0.05em", ["0.05em"]), {
    min: 0,
    max: 0.1,
    step: 0.001,
  });
  // A zero has no magnitude to step on and keeps the floor.
  deepStrictEqual(sliderRange("0em", ["0em"]), {
    min: 0,
    max: 1,
    step: 0.015625,
  });
});

const RAMP = [
  { path: "spacing.1", value: "0.25rem" },
  { path: "spacing.2", value: "0.5rem" },
  { path: "spacing.3", value: "1rem" },
  { path: "spacing.4", value: "2rem" },
];

/**
 * Setting one step is setting the scale: the ratio the drag produced lands
 * on every sibling, so the group keeps the shape it was authored with. The
 * result runs in the group's own order and carries the row asked for, which
 * is the batch the commit writes as one edit.
 */
test("lockstepEdits moves every step of a linked group by one ratio", () => {
  deepStrictEqual(lockstepEdits(RAMP, "spacing.3", "2rem", true), [
    { path: ["spacing", "1"], value: "0.5rem" },
    { path: ["spacing", "2"], value: "1rem" },
    { path: ["spacing", "3"], value: "2rem" },
    { path: ["spacing", "4"], value: "4rem" },
  ]);
});

/** Unlinked, the step is wrong on its own and only the step is written. */
test("lockstepEdits writes only the row asked for when the group is unlinked", () => {
  deepStrictEqual(lockstepEdits(RAMP, "spacing.3", "2rem", false), [
    { path: ["spacing", "3"], value: "2rem" },
  ]);
});

/**
 * A step at zero holds no ratio — every factor of it is still zero — and a
 * ratio of zero scales the group out of existence. Both answer honestly by
 * writing the row asked for and leaving the rest at the document's word.
 */
test("lockstepEdits refuses the two ratios a scale cannot be built from", () => {
  const withZero = [{ path: "spacing.0", value: "0" }, ...RAMP];
  deepStrictEqual(lockstepEdits(withZero, "spacing.0", "1rem", true), [
    { path: ["spacing", "0"], value: "1rem" },
  ]);
  const durations = [
    { path: "motion.fast", value: "150ms" },
    { path: "motion.base", value: "400ms" },
  ];
  deepStrictEqual(lockstepEdits(durations, "motion.base", "0ms", true), [
    { path: ["motion", "base"], value: "0ms" },
  ]);
});

/** A value with no number is a value a ratio cannot act on; the rest still move. */
test("lockstepEdits leaves a sibling a factor cannot mean at its own value", () => {
  const mixed = [
    { path: "spacing.a", value: "1rem" },
    { path: "spacing.b", value: "0.5rem" },
    { path: "spacing.c", value: "auto" },
  ];
  deepStrictEqual(lockstepEdits(mixed, "spacing.a", "2rem", true), [
    { path: ["spacing", "a"], value: "2rem" },
    { path: ["spacing", "b"], value: "1rem" },
  ]);
});

/** The edit carries what CHANGED: a sibling the grid rounds back to its own
 * value has not moved, and writing it would be noise in the undo stack. */
test("lockstepEdits skips a sibling the grid rounds back to unchanged", () => {
  const grid = [
    { path: "spacing.x", value: "0.25rem" },
    { path: "spacing.y", value: "1" },
  ];
  deepStrictEqual(lockstepEdits(grid, "spacing.x", "0.3125rem", true), [
    { path: ["spacing", "x"], value: "0.3125rem" },
  ]);
});

/** The ratio is unit-blind: it is read in canonical space and written back
 * in each row's own unit, so seconds stay seconds beside milliseconds. */
test("lockstepEdits carries the ratio across units", () => {
  const mixed = [
    { path: "motion.a", value: "1000ms" },
    { path: "motion.b", value: "0.5s" },
  ];
  deepStrictEqual(lockstepEdits(mixed, "motion.a", "2000ms", true), [
    { path: ["motion", "a"], value: "2000ms" },
    { path: ["motion", "b"], value: "1s" },
  ]);
});

/** A caller outside the group gets its value and no invented siblings. */
test("lockstepEdits answers a path it does not hold with the edit alone", () => {
  deepStrictEqual(lockstepEdits(RAMP, "spacing.9", "9rem", true), [
    { path: ["spacing", "9"], value: "9rem" },
  ]);
});
