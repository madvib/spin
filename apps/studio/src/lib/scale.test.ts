import { assertEquals } from "@std/assert";
import {
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
  assertEquals(scaleValue("1rem", 1.03), "1rem");
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
  assertEquals(sliderRange("0.25rem", steps), { min: 0, max: 8, step: 0.0625 });
  assertEquals(sliderRange("4rem", steps), { min: 0, max: 8, step: 0.0625 });
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
  assertEquals(sliderRange("0.5rem", radii), { min: 0, max: 1, step: 0.0625 });
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
  assertEquals(sliderRange("0rem", ["0rem"]), { min: 0, max: 1, step: 0.0625 });
});
