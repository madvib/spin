import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { element, facts, other, override, redundant } from "./semantic-helpers.ts";
import { renderMessage, RULES } from "../../src/diagnostics/rules.ts";

test("a class that reaches for another element's decision names it", () => {
  // The theme gave the tight tracking to the first-level heading, and to
  // nothing else; a span carrying that tracking is the markup reaching for
  // what the theme answered elsewhere. A single owner is an error, and the
  // remedy names the element to write instead.
  const [finding] = other("span", "tracking-tight");
  deepStrictEqual(finding?.messageId, "error");
  deepStrictEqual(finding?.severity, "error");
  deepStrictEqual(finding?.data, {
    tag: "span",
    cls: "tracking-tight",
    element: "h1",
    decision: "tracking",
  });
  deepStrictEqual(finding?.remedy, "Put the class on `<h1>.");
  deepStrictEqual(
    renderMessage(RULES["prefer-element"].meta, finding!),
    "the theme gives `<h1>` that tracking; `<span>` is not the element that carries it. Put the class on `<h1>`.",
  );
});

test("a named style reaches for no element's decision", () => {
  // TYPE-b (placement-open): styles attach to any element by design, so a
  // span wearing a named style is never a reach — not even for the size no
  // other element carries. The rule stays silent where it once named `<h1>`.
  deepStrictEqual(other("span", "type-display"), []);
  deepStrictEqual(other("span", "type-body"), []);
  deepStrictEqual(other("div", "type-quote"), []);
});

test("an element that owns the decision is not another element's", () => {
  // The heading owns its tracking, so a class over it is a second opinion
  // about the theme's own value — the theme-value rule's business, not the
  // element rule's.
  deepStrictEqual(other("h1", "tracking-tight"), []);
});

test("a decision the theme gave to several elements stays a suggestion", () => {
  // The theme offers more than one element at that tracking, and which one
  // the author meant is a question the lint cannot answer. It names the
  // first and stays advisory: the remedy offers the element or dropping the
  // class, and the finding carries no error stance.
  const [finding] = other("span", "tracking-normal");
  deepStrictEqual(finding?.messageId, "element");
  deepStrictEqual(finding?.severity, undefined);
  deepStrictEqual(finding?.data["element"], "h2");
  deepStrictEqual(finding?.remedy, "Put the class on `<h2> or drop it.");
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

test("a single-owner tracking on a box is an error", () => {
  // The first-level heading owns that tracking step alone; a span carrying
  // it reaches for the heading's treatment.
  const [finding] = other("span", "tracking-tight");
  deepStrictEqual(finding?.messageId, "error");
  deepStrictEqual(finding?.severity, "error");
  deepStrictEqual(finding?.data, {
    tag: "span",
    cls: "tracking-tight",
    element: "h1",
    decision: "tracking",
  });
  deepStrictEqual(finding?.remedy, "Put the class on `<h1>.");
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

test("a span inside prose text is already typed", () => {
  // Inline text is the prose's own: a span inside a paragraph, a quotation,
  // or a strong run is already typed by the column — not a reach for another
  // element. The exemption reads the owning ancestor, so a bare inline
  // element without its own prose scope (`em`) does not exempt.
  for (const ancestor of ["p", "blockquote", "strong"]) {
    deepStrictEqual(
      other("span", "tracking-tight", undefined, [{ tag: ancestor, classes: [] }]),
      [],
    );
    deepStrictEqual(
      other("span", "tracking-normal", undefined, [{ tag: ancestor, classes: [] }]),
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
