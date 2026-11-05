import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { element, facts, other, override, redundant } from "./semantic-helpers.ts";
import { renderMessage, RULES } from "../../src/diagnostics/rules.ts";

test("a class that reaches for another element's decision names it", () => {
  // The theme gave the level-one size to the heading, and to nothing else;
  // a span carrying that size is the markup reaching for what the theme
  // answered elsewhere. A single owner is an error, and the remedy names
  // the element to write instead.
  const [finding] = other("span", "text-3xl");
  deepStrictEqual(finding?.messageId, "error");
  deepStrictEqual(finding?.severity, "error");
  deepStrictEqual(finding?.data, {
    tag: "span",
    cls: "text-3xl",
    element: "h1",
    decision: "size",
  });
  deepStrictEqual(finding?.remedy, "Put the class on `<h1>.");
  deepStrictEqual(
    renderMessage(RULES["prefer-element"].meta, finding!),
    "the theme gives `<h1>` that size; `<span>` is not the element that carries it. Put the class on `<h1>`.",
  );
});

test("an element that owns the decision is not another element's", () => {
  // The heading owns its size, so a class over it is a second opinion
  // about the theme's own value — the theme-value rule's business, not the
  // element rule's.
  deepStrictEqual(other("h3", "text-sm"), []);
});

test("a decision the theme gave to several elements stays a suggestion", () => {
  // The theme offers more than one element at that size, and which one the
  // author meant is a question the lint cannot answer. It names the first
  // and stays advisory: the remedy offers the element or dropping the class,
  // and the finding carries no error stance.
  const [finding] = other("span", "text-sm");
  deepStrictEqual(finding?.messageId, "element");
  deepStrictEqual(finding?.severity, undefined);
  deepStrictEqual(finding?.data["element"], "alert");
  deepStrictEqual(finding?.remedy, "Put the class on `<alert> or drop it.");
});

test("a single-owner typeface on a box is an error", () => {
  // The quotation owns the serif face alone; a box carrying it is not
  // offering emphasis — it is wearing another element's face.
  const [finding] = other("div", "font-serif");
  deepStrictEqual(finding?.messageId, "error");
  deepStrictEqual(finding?.severity, "error");
  deepStrictEqual(finding?.data, {
    tag: "div",
    cls: "font-serif",
    element: "blockquote",
    decision: "typeface",
  });
  deepStrictEqual(finding?.remedy, "Put the class on `<blockquote>.");
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
      other("span", "text-3xl", undefined, [{ tag: ancestor, classes: [] }]),
      [],
    );
    deepStrictEqual(
      other("span", "text-md", undefined, [{ tag: ancestor, classes: [] }]),
      [],
    );
  }
});

test("a div carrying a shared body size stays a suggestion", () => {
  // The body size is carried by many elements (buttons, body text, lists,
  // tables) — a div wearing it is ambiguous, not a paragraph manqué. The
  // rule names the first carrier and stays advisory.
  const [finding] = other("div", "text-md");
  deepStrictEqual(finding?.messageId, "element");
  deepStrictEqual(finding?.severity, undefined);
});
