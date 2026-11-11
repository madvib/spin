import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { designLanguages } from "@spinjs/theme";
import { measure, quantize, sliderRange } from "./scale.ts";
import {
  declaredValue,
  documentFailure,
  editRefusal,
  rangeProgress,
  tokenPath,
  tokenStatus,
} from "./live-edit.ts";

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

/** A document that declares every role a theme owes. */
function complete(): string {
  return JSON.stringify(designLanguages.minimal, null, 2);
}

/** A document with one token's value written as something else. */
function withValue(text: string, path: string, value: string): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  const segments = path.split(".");
  let node = doc;
  for (const segment of segments.slice(0, -1)) {
    node = node[segment] as Record<string, unknown>;
  }
  const leaf = node[segments[segments.length - 1] as string] as Record<
    string,
    unknown
  >;
  leaf["$value"] = value;
  return JSON.stringify(doc, null, 2);
}

/**
 * A document with a composite token at a path.
 *
 * The groups are made as the token is written, so a fixture can say
 * `border.focus-ring` without the theme having to declare a border group
 * first.
 */
function withComposite(
  text: string,
  path: string,
  type: string,
  value: string,
): string {
  const doc = JSON.parse(text) as Record<string, unknown>;
  const segments = path.split(".");
  let node = doc;
  for (const segment of segments.slice(0, -1)) {
    const next = node[segment];
    if (next === undefined || typeof next !== "object" || Array.isArray(next)) {
      node[segment] = {};
    }
    node = node[segment] as Record<string, unknown>;
  }
  node[segments[segments.length - 1] as string] = {
    $type: type,
    $value: value,
  };
  return JSON.stringify(doc, null, 2);
}

test("the fill paints the share of the travel the value has covered", () => {
  deepStrictEqual(rangeProgress(0, 0, 3), "0%");
  deepStrictEqual(rangeProgress(1.5, 0, 3), "50%");
  deepStrictEqual(rangeProgress(3, 0, 3), "100%");
});

test("a fill never runs past the end of the groove", () => {
  deepStrictEqual(rangeProgress(-1, 0, 3), "0%");
  deepStrictEqual(rangeProgress(9, 0, 3), "100%");
});

test("a track with no travel has no fill", () => {
  deepStrictEqual(rangeProgress(4, 4, 4), "0%");
  deepStrictEqual(rangeProgress(Number.NaN, 0, 3), "0%");
  deepStrictEqual(rangeProgress(1, 0, Number.NaN), "0%");
});

test("the number the readout prints and the share the fill paints are one value", () => {
  // The live edit's own agreement: the value the control shows and the
  // share the groove paints describe the same value, so the thumb and the
  // fill never disagree about where the value is.
  const group = ["0.875rem", "1.125rem", "1.5rem"];
  const track = sliderRange("1.125rem", group);
  for (const raw of [0, 0.5, 1.125, 2, 2.9925]) {
    const shown = measure(quantize("1.125rem", raw));
    deepStrictEqual(shown === undefined, false, "the value reads as a number");
    const n = shown!.n;
    const steps = (n - track.min) / track.step;
    deepStrictEqual(
      Math.abs(steps - Math.round(steps)) < 1e-9,
      true,
      `${n} sits on the track's own grid of ${track.step}`,
    );
    const share = rangeProgress(n, track.min, track.max);
    deepStrictEqual(
      share,
      `${
        Math.round(((n - track.min) / (track.max - track.min)) * 10000) / 100
      }%`,
    );
  }
});

test("the value the theme declares is the one a reset puts back", () => {
  deepStrictEqual(declaredValue(fixture(), "icon.sm", "light"), "0.875rem");
  deepStrictEqual(declaredValue(fixture(), "icon.md", "light"), "1.125rem");
  deepStrictEqual(declaredValue(fixture(), "icon.md", "dark"), "1.25rem");
});

test("a token the document does not declare has nothing to put back", () => {
  deepStrictEqual(declaredValue(fixture(), "icon.lg", "light"), undefined);
  deepStrictEqual(declaredValue(fixture(), "spacing.4", "light"), undefined);
});

test("a document that cannot be read declares nothing", () => {
  deepStrictEqual(declaredValue("{ not json", "icon.sm", "light"), undefined);
});

test("a control is named after the token it edits", () => {
  deepStrictEqual(tokenPath("token-icon.md", undefined), "icon.md");
  deepStrictEqual(tokenPath(undefined, "icon.md"), "icon.md");
  deepStrictEqual(tokenPath("colour-picker", undefined), undefined);
  deepStrictEqual(tokenPath(undefined, undefined), undefined);
});

test("a value that would not build is refused, in the module's own words", () => {
  // The reported failure: a dimension that lost its unit. The theme module
  // owns that rule, and the studio says it in the module's words — a
  // refusal the build would agree with.
  const refusal = editRefusal(
    complete(),
    withValue(complete(), "focus.width", "18"),
    ["focus.width"],
  );
  assert(refusal !== undefined, "the value that would not build was allowed");
  deepStrictEqual(refusal.path, "focus.width");
  assert(
    refusal.message.includes("dimension needs a CSS unit"),
    `the refusal does not say what is wrong: ${refusal.message}`,
  );
});

test("a value the theme can build is allowed through", () => {
  deepStrictEqual(
    editRefusal(
      complete(),
      withValue(complete(), "focus.width", "3px"),
      ["focus.width"],
    ),
    undefined,
  );
});

test("an edit that breaks a contrast floor is refused", () => {
  // The rule the studio already kept: a value that no longer reads on the
  // surface it is read on does not land.
  const refusal = editRefusal(
    complete(),
    withValue(complete(), "color.text", "#ffffff"),
    ["color.text"],
  );
  assert(refusal !== undefined, "the floor was broken and the edit allowed");
  deepStrictEqual(refusal.path, "color.text");
});

test("a document that is already broken stays editable elsewhere", () => {
  // The studio is where a broken theme is repaired: a gate that refused
  // every edit to a broken document would make the repair impossible.
  const broken = withValue(complete(), "focus.width", "18");
  const repaired = withValue(broken, "avatar.sm", "2rem");
  deepStrictEqual(editRefusal(broken, repaired, ["avatar.sm"]), undefined);
});

test("a token that is already broken cannot be left broken by its own edit", () => {
  // The other half of the same promise: the token under the pointer has to
  // be left sound, so a wrong value cannot be made wronger.
  const broken = withValue(complete(), "focus.width", "18");
  const refusal = editRefusal(
    broken,
    withValue(broken, "focus.width", "20"),
    ["focus.width"],
  );
  assert(refusal !== undefined, "the broken token was left broken");
  deepStrictEqual(refusal.path, "focus.width");
});

test("a broken token can be repaired by an edit that makes it sound", () => {
  const broken = withValue(complete(), "focus.width", "18");
  deepStrictEqual(
    editRefusal(broken, withValue(broken, "focus.width", "2px"), [
      "focus.width",
    ]),
    undefined,
  );
});

test("a document that does not parse is refused", () => {
  const refusal = editRefusal(complete(), "{ not json at all\n");
  assert(refusal !== undefined, "a document that does not parse was allowed");
});

test("the refusal names the token the author is holding", () => {
  // Two problems, one of them at the token under the pointer: the refusal
  // is about the token the author can act on.
  const after = withValue(
    withValue(complete(), "color.text", "#ffffff"),
    "focus.width",
    "18",
  );
  const refusal = editRefusal(complete(), after, ["focus.width"]);
  assert(refusal !== undefined, "the edit was allowed");
  deepStrictEqual(refusal.path, "focus.width");
});

test("a document that does not build says why, in the module's words", () => {
  const failure = documentFailure(withValue(complete(), "focus.width", "18"));
  assert(failure !== undefined, "a broken document reported nothing");
  assert(
    failure.includes("focus.width: dimension needs a CSS unit"),
    `the failure does not name the token: ${failure}`,
  );
});

test("a document that builds has nothing to say", () => {
  deepStrictEqual(documentFailure(complete()), undefined);
});

test("a composite's colour that fails the floor it owes is refused", () => {
  // The composite is the theme's `border.focus-ring`: the edge the focus
  // ring is drawn with, so its colour owes the floor `color.focus-ring`
  // owes — three to one on the page. A white edge on a white page does
  // not clear it, and the refusal says so in the module's own words.
  const before = withComposite(
    complete(),
    "border.focus-ring",
    "border",
    "2px solid #333333",
  );
  const after = withComposite(
    before,
    "border.focus-ring",
    "border",
    "2px solid #ffffff",
  );
  const refusal = editRefusal(before, after, ["border.focus-ring"]);
  assert(refusal !== undefined, "the floor was broken and the edit allowed");
  deepStrictEqual(refusal.path, "border.focus-ring");
  assert(
    refusal.message.includes("text needs 3:1"),
    `the refusal does not say what is wrong: ${refusal.message}`,
  );
});

test("a composite's colour that clears the floor it owes is allowed", () => {
  const before = withComposite(
    complete(),
    "border.focus-ring",
    "border",
    "2px solid #333333",
  );
  const after = withComposite(
    before,
    "border.focus-ring",
    "border",
    "2px solid #666666",
  );
  deepStrictEqual(editRefusal(before, after, ["border.focus-ring"]), undefined);
});

test("a composite's part that is not a value the theme accepts is refused", () => {
  // The theme's own rule for a dimension: a width that lost its unit is
  // not a width, and the module is the one that says so.
  const before = withComposite(
    complete(),
    "border.default",
    "border",
    "2px solid #333333",
  );
  const after = withComposite(
    before,
    "border.default",
    "border",
    "2 solid #333333",
  );
  const refusal = editRefusal(before, after, ["border.default"]);
  assert(refusal !== undefined, "the value that would not build was allowed");
  deepStrictEqual(refusal.path, "border.default");
  assert(
    refusal.message.includes("dimension needs a CSS unit"),
    `the refusal does not say what is wrong: ${refusal.message}`,
  );
});

test("a composite the theme can build is allowed through", () => {
  const before = withComposite(
    complete(),
    "border.default",
    "border",
    "2px solid #333333",
  );
  const after = withComposite(
    before,
    "border.default",
    "border",
    "1px dashed #333333",
  );
  deepStrictEqual(editRefusal(before, after, ["border.default"]), undefined);
});

test("tokenStatus reports aliases, dark overrides and session edits", () => {
  const project = JSON.stringify(
    {
      radius: {
        md: { $type: "dimension", $value: "0.25rem" },
      },
      card: {
        radius: {
          $type: "dimension",
          $value: "{radius.md}",
          $modes: { dark: "0.5rem" },
        },
      },
    },
    null,
    2,
  );
  deepStrictEqual(tokenStatus(project, project, "card.radius", "light"), {
    raw: "{radius.md}",
    aliasOf: "radius.md",
    restatedInDark: false,
    modified: false,
  });
  deepStrictEqual(tokenStatus(project, project, "card.radius", "dark"), {
    raw: "0.5rem",
    aliasOf: undefined,
    restatedInDark: true,
    modified: false,
  });
  const edited = withValue(project, "radius.md", "0.375rem");
  deepStrictEqual(tokenStatus(edited, project, "radius.md", "light"), {
    raw: "0.375rem",
    aliasOf: undefined,
    restatedInDark: false,
    modified: true,
  });
});
