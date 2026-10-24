import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { relativeLuminance } from "../pipeline/color.ts";
import { generateScale, invertColor, mixColors } from "./color.ts";

const HEX = /^#[0-9a-f]{6}$/;

/** Splits `#rrggbb` into 0-255 channels, failing if the format is wrong. */
function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(hex);
  if (!match) throw new Error(`expected a #rrggbb colour, got: ${hex}`);
  return [
    parseInt(match[1], 16),
    parseInt(match[2], 16),
    parseInt(match[3], 16),
  ];
}

test("invertColor maps black to white and white to black", () => {
  deepStrictEqual(invertColor("#000000"), "#ffffff");
  deepStrictEqual(invertColor("#ffffff"), "#000000");
});
test("invertColor is its own inverse", () => {
  for (const hex of ["#ff0000", "#3a7bd5", "#0a0a0a"]) {
    deepStrictEqual(invertColor(invertColor(hex)), hex);
  }
});
test("invertColor emits lowercase #rrggbb regardless of input casing", () => {
  assert(HEX.test(invertColor("#AABBCC")));
  assert(HEX.test(invertColor("#AABBCC".toLowerCase())));
});
test("mixColors returns each endpoint at the extremes of the amount", () => {
  deepStrictEqual(mixColors("#ff0000", "#0000ff", 0), "#ff0000");
  deepStrictEqual(mixColors("#ff0000", "#0000ff", 1), "#0000ff");
});
test("mixColors returns the input unchanged when both colours are identical", () => {
  for (const amount of [0, 0.25, 0.5, 0.75, 1]) {
    deepStrictEqual(mixColors("#3a7bd5", "#3a7bd5", amount), "#3a7bd5");
  }
});
test("mixColors at the halfway point lands between the two inputs", () => {
  const mixed = channels(mixColors("#000000", "#ffffff", 0.5));

  for (const channel of mixed) {
    assert(
      channel >= 127 && channel <= 128,
      `midpoint channel should be mid-grey, got ${mixed.join(",")}`,
    );
  }
});
test("mixColors stays a valid colour for every amount", () => {
  for (const amount of [0, 0.1, 0.5, 0.9, 1]) {
    assert(HEX.test(mixColors("#12ab34", "#fedcba", amount)));
  }
});
test("generateScale returns one colour per requested step", () => {
  deepStrictEqual(generateScale("#3a7bd5", 5).length, 5);
  deepStrictEqual(generateScale("#3a7bd5", 11).length, 11);
});
test("generateScale spans black to white", () => {
  const scale = generateScale("#3a7bd5", 9);

  deepStrictEqual(scale[0], "#000000");
  deepStrictEqual(scale[scale.length - 1], "#ffffff");
});
test("generateScale ramps from darker to lighter without reversing", () => {
  const scale = generateScale("#3a7bd5", 9);
  const luminances = scale.map(relativeLuminance);

  for (let i = 1; i < luminances.length; i++) {
    assert(
      luminances[i] >= luminances[i - 1],
      `step ${i} (${scale[i]}) is darker than step ${i - 1} (${scale[i - 1]})`,
    );
  }
  assert(
    relativeLuminance(scale[0]) < relativeLuminance(scale[scale.length - 1]),
    "the scale must get lighter from first to last",
  );
});
test("generateScale never darkens an individual colour channel", () => {
  const scale = generateScale("#3a7bd5", 9);

  for (let i = 1; i < scale.length; i++) {
    const before = channels(scale[i - 1]);
    const after = channels(scale[i]);
    for (let c = 0; c < 3; c++) {
      assert(
        after[c] >= before[c],
        `channel ${c} darkened at step ${i}: ${scale[i - 1]} -> ${scale[i]}`,
      );
    }
  }
});
test("generateScale emits only valid #rrggbb colours", () => {
  for (const step of generateScale("#ff00ff", 7)) {
    assert(HEX.test(step), `not a #rrggbb colour: ${step}`);
  }
});
