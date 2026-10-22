import { assert, assertEquals } from "@std/assert";
import { scaffoldTheme, treeToJson } from "@spin/theme";
import { measure, quantize, sliderRange } from "./scale.ts";
import {
  declaredValue,
  documentFailure,
  editRefusal,
  rangeProgress,
  tokenPath,
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
  return treeToJson(scaffoldTheme());
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

Deno.test("a value that would not build is refused, in the module's own words", () => {
  // The reported failure: a dimension that lost its unit. The theme module
  // owns that rule, and the studio says it in the module's words — a
  // refusal the build would agree with.
  const refusal = editRefusal(
    complete(),
    withValue(complete(), "focus.width", "18"),
    ["focus.width"],
  );
  assert(refusal !== undefined, "the value that would not build was allowed");
  assertEquals(refusal.path, "focus.width");
  assert(
    refusal.message.includes("dimension needs a CSS unit"),
    `the refusal does not say what is wrong: ${refusal.message}`,
  );
});

Deno.test("a value the theme can build is allowed through", () => {
  assertEquals(
    editRefusal(
      complete(),
      withValue(complete(), "focus.width", "3px"),
      ["focus.width"],
    ),
    undefined,
  );
});

Deno.test("an edit that breaks a contrast floor is refused", () => {
  // The rule the studio already kept: a value that no longer reads on the
  // surface it is read on does not land.
  const refusal = editRefusal(
    complete(),
    withValue(complete(), "color.text", "#ffffff"),
    ["color.text"],
  );
  assert(refusal !== undefined, "the floor was broken and the edit allowed");
  assertEquals(refusal.path, "color.text");
});

Deno.test("a document that is already broken stays editable elsewhere", () => {
  // The studio is where a broken theme is repaired: a gate that refused
  // every edit to a broken document would make the repair impossible.
  const broken = withValue(complete(), "focus.width", "18");
  const repaired = withValue(broken, "avatar.sm", "2rem");
  assertEquals(editRefusal(broken, repaired, ["avatar.sm"]), undefined);
});

Deno.test("a token that is already broken cannot be left broken by its own edit", () => {
  // The other half of the same promise: the token under the pointer has to
  // be left sound, so a wrong value cannot be made wronger.
  const broken = withValue(complete(), "focus.width", "18");
  const refusal = editRefusal(
    broken,
    withValue(broken, "focus.width", "20"),
    ["focus.width"],
  );
  assert(refusal !== undefined, "the broken token was left broken");
  assertEquals(refusal.path, "focus.width");
});

Deno.test("a broken token can be repaired by an edit that makes it sound", () => {
  const broken = withValue(complete(), "focus.width", "18");
  assertEquals(
    editRefusal(broken, withValue(broken, "focus.width", "2px"), [
      "focus.width",
    ]),
    undefined,
  );
});

Deno.test("a document that does not parse is refused", () => {
  const refusal = editRefusal(complete(), "{ not json at all\n");
  assert(refusal !== undefined, "a document that does not parse was allowed");
});

Deno.test("the refusal names the token the author is holding", () => {
  // Two problems, one of them at the token under the pointer: the refusal
  // is about the token the author can act on.
  const after = withValue(
    withValue(complete(), "color.text", "#ffffff"),
    "focus.width",
    "18",
  );
  const refusal = editRefusal(complete(), after, ["focus.width"]);
  assert(refusal !== undefined, "the edit was allowed");
  assertEquals(refusal.path, "focus.width");
});

Deno.test("a document that does not build says why, in the module's words", () => {
  const failure = documentFailure(withValue(complete(), "focus.width", "18"));
  assert(failure !== undefined, "a broken document reported nothing");
  assert(
    failure.includes("focus.width: dimension needs a CSS unit"),
    `the failure does not name the token: ${failure}`,
  );
});

Deno.test("a document that builds has nothing to say", () => {
  assertEquals(documentFailure(complete()), undefined);
});
