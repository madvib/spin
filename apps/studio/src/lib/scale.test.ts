import { assertEquals } from "@std/assert";
import {
  lockstepEdits,
  measure,
  quantize,
  robustMax,
  scaleValue,
  sliderRange,
} from "./scale.ts";

Deno.test("measure reads the shapes a theme's numbers come in", () => {
  assertEquals(measure("150ms"), { kind: "duration", n: 150, unit: "ms" });
  assertEquals(measure("0.25s"), { kind: "duration", n: 0.25, unit: "s" });
  assertEquals(measure("0.25rem"), { kind: "length", n: 0.25, unit: "rem" });
  assertEquals(measure("9999px"), { kind: "length", n: 9999, unit: "px" });
  assertEquals(measure("0"), { kind: "number", n: 0, unit: "" });
  assertEquals(measure("1000"), { kind: "number", n: 1000, unit: "" });
  assertEquals(measure("50%"), { kind: "length", n: 50, unit: "%" });
});

Deno.test("measure refuses what no slider can step through", () => {
  assertEquals(measure("#3f3f46"), undefined);
  assertEquals(measure("linear"), undefined);
  assertEquals(measure("cubic-bezier(0.2, 0, 0, 1)"), undefined);
  assertEquals(measure("0 1px 3px rgb(0 0 0 / 0.1)"), undefined);
  assertEquals(measure("ui-sans-serif, system-ui"), undefined);
  assertEquals(measure("calc(1s - 200ms)"), undefined);
});

Deno.test("scaleValue scales in the unit the theme authored", () => {
  assertEquals(scaleValue("0.25rem", 2), "0.5rem");
  assertEquals(scaleValue("0.0625rem", 4), "0.25rem");
  assertEquals(scaleValue("150ms", 1.2), "180ms");
  assertEquals(scaleValue("0.25s", 2), "0.5s");
  assertEquals(scaleValue("8px", 1.5), "12px");
  assertEquals(scaleValue("0", 2), "0");
  assertEquals(scaleValue("1000", 1.25), "1250");
  assertEquals(scaleValue("9999px", 2), "19998px");
});

Deno.test("scaleValue keeps the precision the author wrote", () => {
  // A value the author authored to a tenth stays to a tenth: the factor is
  // a nudge on their number, not a licence to invent decimals.
  assertEquals(scaleValue("0.5", 1.4), "0.7");
  assertEquals(scaleValue("0.5rem", 1.5), "0.75rem");
  // The spacing scale is a sixteenth grid, and a scaled step stays on it —
  // a nudge that would land between steps snaps back rather than inventing
  // a value the scale never had.
  assertEquals(scaleValue("1rem", 1.015), "1rem");
  assertEquals(scaleValue("1rem", 1.25), "1.25rem");
});

Deno.test("scaleValue refuses what a factor cannot mean", () => {
  assertEquals(scaleValue("#3f3f46", 2), undefined);
  assertEquals(scaleValue("linear", 2), undefined);
  assertEquals(scaleValue("cubic-bezier(0.2, 0, 0, 1)", 2), undefined);
  assertEquals(scaleValue("0 1px 3px rgb(0 0 0 / 0.1)", 2), undefined);
});

Deno.test("quantize lands a proposed number back on the theme's grid", () => {
  assertEquals(quantize("0.0625rem", 0.07), "0.0625rem");
  assertEquals(quantize("8px", 8.6), "9px");
  assertEquals(quantize("150ms", 152), "152ms");
  assertEquals(quantize("0.5px", 0.54), "0.5px");
  assertEquals(quantize("1000", 1000.4), "1000");
});

Deno.test("robustMax reads the top of a ramp without being fooled by an outlier", () => {
  assertEquals(robustMax([0, 4, 8, 16, 32, 64]), 64);
  assertEquals(robustMax([150, 250, 400]), 400);
  assertEquals(robustMax([14, 18, 24]), 24);
  assertEquals(robustMax([1000, 2000, 3000]), 3000);
  // `radius.full` is a pill, not the top of the scale: a value this far
  // above the rest would pin every other slider at zero.
  assertEquals(robustMax([0, 2, 4, 8, 9999]), 8);
});

Deno.test("robustMax answers an empty or flat group without lying", () => {
  assertEquals(robustMax([]), 0);
  assertEquals(robustMax([0]), 0);
  assertEquals(robustMax([0, 0]), 0);
  // Two values, the lower of them zero: there is nothing to be an outlier
  // against, so the value stands.
  assertEquals(robustMax([0, 8]), 8);
});

Deno.test("sliderRange gives every step of a group the same ceiling", () => {
  const steps = ["0", "0.25rem", "0.5rem", "1rem", "2rem", "4rem"];
  // The ramp's ceiling: twice the top, in this row's own unit, stepping on
  // the sixteenth grid the scale is authored in.
  assertEquals(sliderRange("0.25rem", steps), { min: 0, max: 8, step: 0.03125 });
  assertEquals(sliderRange("4rem", steps), { min: 0, max: 8, step: 0.03125 });
  const durations = ["150ms", "250ms", "400ms"];
  assertEquals(sliderRange("150ms", durations), { min: 0, max: 800, step: 1 });
  assertEquals(sliderRange("1000", ["0", "1000", "2000", "3000"]), {
    min: 0,
    max: 6000,
    step: 1,
  });
});

Deno.test("sliderRange lets a row above the ramp take its own headroom", () => {
  const radii = ["0", "0.125rem", "0.25rem", "0.5rem", "9999px"];
  // The pill does not drag the rest of the scale's ceiling up with it…
  assertEquals(sliderRange("0.5rem", radii), { min: 0, max: 1, step: 0.03125 });
  // …and it still has room to grow.
  assertEquals(sliderRange("9999px", radii), {
    min: 0,
    max: 19998,
    step: 1,
  });
});

Deno.test("sliderRange converts the ceiling into the row's own unit", () => {
  assertEquals(sliderRange("0.25s", ["0.25s", "0.4s"]), {
    min: 0,
    max: 0.8,
    step: 0.001,
  });
});

Deno.test("sliderRange never hands back a dead track", () => {
  assertEquals(sliderRange("0", ["0", "0"]), { min: 0, max: 16, step: 1 });
  assertEquals(sliderRange("0ms", ["0ms"]), { min: 0, max: 400, step: 1 });
  assertEquals(sliderRange("0rem", ["0rem"]), { min: 0, max: 1, step: 0.03125 });
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
Deno.test("lockstepEdits moves every step of a linked group by one ratio", () => {
  assertEquals(lockstepEdits(RAMP, "spacing.3", "2rem", true), [
    { path: ["spacing", "1"], value: "0.5rem" },
    { path: ["spacing", "2"], value: "1rem" },
    { path: ["spacing", "3"], value: "2rem" },
    { path: ["spacing", "4"], value: "4rem" },
  ]);
});

/** Unlinked, the step is wrong on its own and only the step is written. */
Deno.test("lockstepEdits writes only the row asked for when the group is unlinked", () => {
  assertEquals(lockstepEdits(RAMP, "spacing.3", "2rem", false), [
    { path: ["spacing", "3"], value: "2rem" },
  ]);
});

/**
 * A step at zero holds no ratio — every factor of it is still zero — and a
 * ratio of zero scales the group out of existence. Both answer honestly by
 * writing the row asked for and leaving the rest at the document's word.
 */
Deno.test("lockstepEdits refuses the two ratios a scale cannot be built from", () => {
  const withZero = [{ path: "spacing.0", value: "0" }, ...RAMP];
  assertEquals(lockstepEdits(withZero, "spacing.0", "1rem", true), [
    { path: ["spacing", "0"], value: "1rem" },
  ]);
  const durations = [
    { path: "motion.fast", value: "150ms" },
    { path: "motion.base", value: "400ms" },
  ];
  assertEquals(lockstepEdits(durations, "motion.base", "0ms", true), [
    { path: ["motion", "base"], value: "0ms" },
  ]);
});

/** A value with no number is a value a ratio cannot act on; the rest still move. */
Deno.test("lockstepEdits leaves a sibling a factor cannot mean at its own value", () => {
  const mixed = [
    { path: "spacing.a", value: "1rem" },
    { path: "spacing.b", value: "0.5rem" },
    { path: "spacing.c", value: "auto" },
  ];
  assertEquals(lockstepEdits(mixed, "spacing.a", "2rem", true), [
    { path: ["spacing", "a"], value: "2rem" },
    { path: ["spacing", "b"], value: "1rem" },
  ]);
});

/** The edit carries what CHANGED: a sibling the grid rounds back to its own
 * value has not moved, and writing it would be noise in the undo stack. */
Deno.test("lockstepEdits skips a sibling the grid rounds back to unchanged", () => {
  const grid = [
    { path: "spacing.x", value: "0.25rem" },
    { path: "spacing.y", value: "1" },
  ];
  assertEquals(lockstepEdits(grid, "spacing.x", "0.3125rem", true), [
    { path: ["spacing", "x"], value: "0.3125rem" },
  ]);
});

/** The ratio is unit-blind: it is read in canonical space and written back
 * in each row's own unit, so seconds stay seconds beside milliseconds. */
Deno.test("lockstepEdits carries the ratio across units", () => {
  const mixed = [
    { path: "motion.a", value: "1000ms" },
    { path: "motion.b", value: "0.5s" },
  ];
  assertEquals(lockstepEdits(mixed, "motion.a", "2000ms", true), [
    { path: ["motion", "a"], value: "2000ms" },
    { path: ["motion", "b"], value: "1s" },
  ]);
});

/** A caller outside the group gets its value and no invented siblings. */
Deno.test("lockstepEdits answers a path it does not hold with the edit alone", () => {
  assertEquals(lockstepEdits(RAMP, "spacing.9", "9rem", true), [
    { path: ["spacing", "9"], value: "9rem" },
  ]);
});
