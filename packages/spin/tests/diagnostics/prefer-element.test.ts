import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { element, facts, other, override, redundant } from "./semantic-helpers.ts";
import { renderMessage, RULES } from "../../src/diagnostics/rules.ts";

test("a removed atom draws no element finding", () => {
  // TYPE-c (styles own type): `tracking-*`/`leading-*` are no longer
  // vocabulary — the element rule reads only classes the catalog produces,
  // so a removed atom is silent here. The closed vocabulary owns it (unknown
  // with a style suggestion; see type-suggestions.test.ts).
  deepStrictEqual(other("span", "tracking-tight"), []);
  deepStrictEqual(other("span", "tracking-normal"), []);
  deepStrictEqual(other("span", "leading-tight"), []);
});

test("a named style reaches for no element's decision", () => {
  // TYPE-b (placement-open): styles attach to any element by design, so a
  // span wearing a named style is never a reach — not even for the size no
  // other element carries. The rule stays silent where it once named `<h1>`.
  deepStrictEqual(other("span", "type-display"), []);
  deepStrictEqual(other("span", "type-body"), []);
  deepStrictEqual(other("div", "type-quote"), []);
});

test("an element wearing a removed atom draws no element finding", () => {
  // Same deletion from the owner's side: `tracking-tight` on its own
  // heading is unknown, not a second opinion — the theme-value rule has
  // nothing to compare either.
  deepStrictEqual(other("h1", "tracking-tight"), []);
});

test("a twice-owned ink stays a suggestion", () => {
  // The link's ink is carried twice (the link paints it globally, and the
  // document column restates it for visited text) — so a box carrying it is
  // ambiguous, not a link manqué. The rule names the first and stays
  // advisory.
  const [finding] = other("div", "text-link");
  deepStrictEqual(finding?.messageId, "element");
  deepStrictEqual(finding?.severity, undefined);
  deepStrictEqual(finding?.data["element"], "a");
  deepStrictEqual(finding?.data["decision"], "fill");
  deepStrictEqual(finding?.remedy, "Put the class on `<a> or drop it.");
});

test("a span inside prose text wearing a style is already typed", () => {
  // Inline text is the prose's own: a span inside a paragraph, a quotation,
  // or a strong run is already typed by the column — not a reach for another
  // element. The exemption reads the owning ancestor, so a bare inline
  // element without its own prose scope (`em`) does not exempt. TYPE-c: the
  // legs wear named styles now that the tracking atoms are removed.
  for (const ancestor of ["p", "blockquote", "strong"]) {
    deepStrictEqual(
      other("span", "type-body", undefined, [{ tag: ancestor, classes: [] }]),
      [],
    );
    deepStrictEqual(
      other("span", "type-caption", undefined, [{ tag: ancestor, classes: [] }]),
      [],
    );
  }
});

test("a div carrying a shared body size stays silent under named styles", () => {
  // TYPE-b: sizes arrive only inside named styles, and styles attach
  // anywhere — so a div wearing the body style is not a paragraph manqué.
  // The shared-size suggestion now belongs to surviving single-property
  // utilities; the style itself draws nothing.
  deepStrictEqual(other("div", "type-body"), []);
});
