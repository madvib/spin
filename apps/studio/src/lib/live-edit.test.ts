import { assertEquals } from "@std/assert";
import { measure, quantize, sliderRange } from "./scale.ts";
import { declaredValue, rangeProgress, tokenPath } from "./live-edit.ts";

/** A document small enough to read and real enough to answer about. */
function fixture(): string {
  return JSON.stringify(
    {
      icon: {
        sm: { $type: "dimension", $value: "0.875rem" },
        md: {
          $type: "dimension",
          $value: "1.125rem",
          $modes: { dark: "1.25rem" },
        },
      },
    },
    null,
    2,
  );
}

Deno.test("the fill paints the share of the travel the value has covered", () => {
  assertEquals(rangeProgress(0, 0, 3), "0%");
  assertEquals(rangeProgress(1.5, 0, 3), "50%");
  assertEquals(rangeProgress(3, 0, 3), "100%");
});

Deno.test("a fill never runs past the end of the groove", () => {
  assertEquals(rangeProgress(-1, 0, 3), "0%");
  assertEquals(rangeProgress(9, 0, 3), "100%");
});

Deno.test("a track with no travel has no fill", () => {
  assertEquals(rangeProgress(4, 4, 4), "0%");
  assertEquals(rangeProgress(Number.NaN, 0, 3), "0%");
  assertEquals(rangeProgress(1, 0, Number.NaN), "0%");
});

Deno.test("the number the readout prints and the share the fill paints are one value", () => {
  // The live edit's own agreement: the value the control shows and the
  // share the groove paints describe the same value, so the thumb and the
  // fill never disagree about where the value is.
  const group = ["0.875rem", "1.125rem", "1.5rem"];
  const track = sliderRange("1.125rem", group);
  for (const raw of [0, 0.5, 1.125, 2, 2.9925]) {
    const shown = measure(quantize("1.125rem", raw));
    assertEquals(shown === undefined, false, "the value reads as a number");
    const n = shown!.n;
    const steps = (n - track.min) / track.step;
    assertEquals(
      Math.abs(steps - Math.round(steps)) < 1e-9,
      true,
      `${n} sits on the track's own grid of ${track.step}`,
    );
    const share = rangeProgress(n, track.min, track.max);
    assertEquals(
      share,
      `${
        Math.round(((n - track.min) / (track.max - track.min)) * 10000) / 100
      }%`,
    );
  }
});

Deno.test("the value the theme declares is the one a reset puts back", () => {
  assertEquals(declaredValue(fixture(), "icon.sm", "light"), "0.875rem");
  assertEquals(declaredValue(fixture(), "icon.md", "light"), "1.125rem");
  assertEquals(declaredValue(fixture(), "icon.md", "dark"), "1.25rem");
});

Deno.test("a token the document does not declare has nothing to put back", () => {
  assertEquals(declaredValue(fixture(), "icon.lg", "light"), undefined);
  assertEquals(declaredValue(fixture(), "spacing.4", "light"), undefined);
});

Deno.test("a document that cannot be read declares nothing", () => {
  assertEquals(declaredValue("{ not json", "icon.sm", "light"), undefined);
});

Deno.test("a control is named after the token it edits", () => {
  assertEquals(tokenPath("token-icon.md", undefined), "icon.md");
  assertEquals(tokenPath(undefined, "icon.md"), "icon.md");
  assertEquals(tokenPath("colour-picker", undefined), undefined);
  assertEquals(tokenPath(undefined, undefined), undefined);
});
