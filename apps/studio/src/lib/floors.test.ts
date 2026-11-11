import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { contrastRatio } from "@spinjs/theme";
import { checks, floorFindings, measureFloors, remedyText } from "./floors.ts";
import { applyEdits } from "./theme.ts";

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

test("a failing floor names the token, the pair, the floor and the ratio", () => {
  const findings = floorFindings(fixture("#2f9e44"));
  deepStrictEqual(findings.length, 1);
  const finding = findings[0]!;
  deepStrictEqual(finding.path, "color.semantic.success");
  deepStrictEqual(finding.fg, "color.semantic.success");
  deepStrictEqual(finding.bg, "color.surface");
  deepStrictEqual(finding.min, 4.5);
  // The ratio is what the pair measures, not what the studio believes about
  // it: the module's own measurement, read back.
  deepStrictEqual(finding.ratio, contrastRatio("#2f9e44", "#ffffff"));
  deepStrictEqual(finding.ratio < finding.min, true);
});

test("the value a finding offers is one that clears the floor", () => {
  // The contract of the remedy: apply it and the finding is gone. A value
  // that merely sounds right would leave the author where they started.
  const finding = floorFindings(fixture("#2f9e44"))[0]!;
  const cleared = contrastRatio(finding.remedy.value, "#ffffff");
  deepStrictEqual(cleared >= finding.min, true);
});

test("the remedy is the nearest value that clears the floor", () => {
  // Nearer than the extremes: the remedy overshoots the floor by less than
  // the distance to black, so the author's colour keeps its character instead
  // of being replaced by the end of the ramp.
  const finding = floorFindings(fixture("#2f9e44"))[0]!;
  const overshoot = finding.remedy.ratio - finding.min;
  const toBlack = contrastRatio("#000000", "#ffffff") - finding.min;
  deepStrictEqual(overshoot < toBlack, true);
});

test("a remedy says which way the token has to move", () => {
  // A pale colour on a light surface can only be fixed by going down; the
  // direction is what tells the author which way to move the slider.
  const onWhite = floorFindings(fixture("#2f9e44"))[0]!;
  deepStrictEqual(onWhite.remedy.direction, "darker");

  // And a dark colour on a dark surface by going up.
  const onBlack = floorFindings(fixture("#123456", "#000000"))[0]!;
  deepStrictEqual(onBlack?.remedy.direction, "lighter");
});

test("a floor that holds is not a finding", () => {
  deepStrictEqual(floorFindings(fixture("#0b5c22")).length, 0);
});

test("a document that does not parse has no findings", () => {
  deepStrictEqual(floorFindings("{not json").length, 0);
});

test("the remedy text names the value and the ratio it reaches", () => {
  const finding = floorFindings(fixture("#2f9e44"))[0]!;
  const text = remedyText(finding.remedy);
  deepStrictEqual(text.includes(finding.remedy.value), true);
  deepStrictEqual(text.includes("color.surface"), true);
  deepStrictEqual(text.includes("Darken"), true);
});

test("a measured floor is the ratio the pair makes", () => {
  // The page reads the same pairs the checks read, in a mode: the number it
  // shows is the one the theme module measures.
  const measured = measureFloors(fixture("#2f9e44"), "light");
  const success = measured.find((floor) =>
    floor.fg === "color.semantic.success"
  );
  deepStrictEqual(success?.min, 4.5);
  deepStrictEqual(success?.ratio, contrastRatio("#2f9e44", "#ffffff"));
});

test("a failing floor offers a value that clears it", () => {
  const success = measureFloors(fixture("#2f9e44"), "light").find((floor) =>
    floor.fg === "color.semantic.success"
  );
  deepStrictEqual(success?.remedy !== null, true);
  const cleared = contrastRatio(success?.remedy as string, "#ffffff");
  deepStrictEqual(cleared >= 4.5, true);
});

test("a floor that holds offers nothing: there is nothing to fix", () => {
  const success = measureFloors(fixture("#0b5c22"), "light").find((floor) =>
    floor.fg === "color.semantic.success"
  );
  deepStrictEqual((success?.ratio ?? 0) >= 4.5, true);
  deepStrictEqual(success?.remedy, null);
});

/**
 * The document whose DARK side fails a floor the light side keeps.
 *
 * The success green clears the floor on white and disappears on ink; the
 * base declares both, so the base is the light side and dark is the
 * restatement — the arrangement every two-mode starter has.
 */
function darkFailure(): string {
  return JSON.stringify({
    modes: ["light", "dark"],
    color: {
      $type: "color",
      surface: { $value: "#ffffff", $modes: { dark: "#0b0f19" } },
      "semantic": { success: { $value: "#0b5c22" } },
    },
  });
}

test("the checks read a restatement, and name the mode it fails in", () => {
  // The base keeps the floor; the dark value does not. A check that read the
  // base alone would say the document clears every floor, which is the
  // false sentence the panel used to say.
  const found = checks(darkFailure()).filter((check) =>
    check.path === "color.semantic.success"
  );
  deepStrictEqual(found.length, 1);
  deepStrictEqual(found[0]!.message.includes("in dark"), true);
  deepStrictEqual(found[0]!.remedy?.mode, "dark");
});

test("the fix a restatement finding offers is written into that mode", () => {
  // The contract of the remedy: apply it where it says, and the finding is
  // gone — while the base, which was never the problem, keeps its value.
  const finding = checks(darkFailure()).find((check) =>
    check.path === "color.semantic.success"
  )!;
  const remedy = finding.remedy!;
  const next = applyEdits(
    darkFailure(),
    [{ path: remedy.path.split("."), value: remedy.value }],
    "dark",
  );
  const after = checks(next).filter((check) =>
    check.path === "color.semantic.success"
  );
  deepStrictEqual(after.length, 0);
  // The write landed in the restatement, and the base — which was never the
  // problem — still holds the value the author chose.
  const doc = JSON.parse(next) as {
    color: {
      semantic: {
        success: { $value: string; $modes?: Record<string, string> };
      };
    };
  };
  const held = doc.color.semantic.success;
  deepStrictEqual(held.$value, "#0b5c22");
  deepStrictEqual(held.$modes?.dark, remedy.value);
});

test("a mode is measured on the values it shows", () => {
  // The dark slot restates the surface, so the pair the dark mode shows is
  // not the pair the light mode shows.
  const document = JSON.stringify({
    color: {
      $type: "color",
      surface: { $value: "#ffffff", $modes: { dark: "#101010" } },
      "semantic": { success: { $value: "#2f9e44" } },
    },
  });
  const light = measureFloors(document, "light").find((floor) =>
    floor.fg === "color.semantic.success"
  );
  const dark = measureFloors(document, "dark").find((floor) =>
    floor.fg === "color.semantic.success"
  );
  deepStrictEqual(light?.ratio, contrastRatio("#2f9e44", "#ffffff"));
  deepStrictEqual(dark?.ratio, contrastRatio("#2f9e44", "#101010"));
});
