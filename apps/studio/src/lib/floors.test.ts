import { assertEquals } from "@std/assert";
import { contrastRatio } from "@spin/theme";
import { floorFindings, remedyText } from "./floors.ts";

/**
 * A document with one failing floor and everything else the floors ask for
 * either absent or clearing.
 *
 * `color.semantic.success` is a mid green on a white surface: it is legible
 * as a mark and unreadable as a word, which is exactly the case the contract
 * puts a floor on.
 */
function fixture(success: string, surface = "#ffffff"): string {
  return JSON.stringify({
    color: {
      $type: "color",
      surface: { $value: surface },
      semantic: { success: { $value: success } },
    },
  });
}

Deno.test("a failing floor names the token, the pair, the floor and the ratio", () => {
  const findings = floorFindings(fixture("#2f9e44"));
  assertEquals(findings.length, 1);
  const finding = findings[0]!;
  assertEquals(finding.path, "color.semantic.success");
  assertEquals(finding.fg, "color.semantic.success");
  assertEquals(finding.bg, "color.surface");
  assertEquals(finding.min, 4.5);
  // The ratio is what the pair measures, not what the studio believes about
  // it: the module's own measurement, read back.
  assertEquals(finding.ratio, contrastRatio("#2f9e44", "#ffffff"));
  assertEquals(finding.ratio < finding.min, true);
});

Deno.test("the value a finding offers is one that clears the floor", () => {
  // The contract of the remedy: apply it and the finding is gone. A value
  // that merely sounds right would leave the author where they started.
  const finding = floorFindings(fixture("#2f9e44"))[0]!;
  const cleared = contrastRatio(finding.remedy.value, "#ffffff");
  assertEquals(cleared >= finding.min, true);
});

Deno.test("the remedy is the nearest value that clears the floor", () => {
  // Nearer than the extremes: the remedy overshoots the floor by less than
  // the distance to black, so the author's colour keeps its character instead
  // of being replaced by the end of the ramp.
  const finding = floorFindings(fixture("#2f9e44"))[0]!;
  const overshoot = finding.remedy.ratio - finding.min;
  const toBlack = contrastRatio("#000000", "#ffffff") - finding.min;
  assertEquals(overshoot < toBlack, true);
});

Deno.test("a remedy says which way the token has to move", () => {
  // A pale colour on a light surface can only be fixed by going down; the
  // direction is what tells the author which way to move the slider.
  const onWhite = floorFindings(fixture("#2f9e44"))[0]!;
  assertEquals(onWhite.remedy.direction, "darker");

  // And a dark colour on a dark surface by going up.
  const onBlack = floorFindings(fixture("#123456", "#000000"))[0]!;
  assertEquals(onBlack?.remedy.direction, "lighter");
});

Deno.test("a floor that holds is not a finding", () => {
  assertEquals(floorFindings(fixture("#0b5c22")).length, 0);
});

Deno.test("a document that does not parse has no findings", () => {
  assertEquals(floorFindings("{not json").length, 0);
});

Deno.test("the remedy text names the value and the ratio it reaches", () => {
  const finding = floorFindings(fixture("#2f9e44"))[0]!;
  const text = remedyText(finding.remedy);
  assertEquals(text.includes(finding.remedy.value), true);
  assertEquals(text.includes("color.surface"), true);
  assertEquals(text.includes("Darken"), true);
});
