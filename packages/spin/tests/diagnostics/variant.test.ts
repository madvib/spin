import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { starterThemes } from "../../src/theme/themes/index.ts";
import {
  type AncestorFacts,
  checkNoRedundantClass,
  checkPreferElement,
  checkPreferThemeValue,
  type ClassFacts,
  type Facts,
  type SemanticOptions,
} from "../../src/diagnostics/core.ts";
import { factsFor } from "../../src/diagnostics/facts.ts";
import { renderMessage, RULES } from "../../src/diagnostics/rules.ts";

/**
 * A variant is how a primitive is told to change.
 *
 * The base of a primitive is the element's own look, and a variant speaks over
 * it: the bare button clears the fill, the edge and the padding, and leaves
 * the ink to the utilities — because the ink the base declares is the ink ON
 * the fill, and a button with no fill has no foreground to be.
 *
 * So the rules read the element as it stands: what the variant cleared is not
 * the element's, and what the variant claimed is not a second opinion about
 * the base. The two rules that compare a class with the element have to know
 * this, or they report the variant's own answer as a fight.
 */

const facts: Facts = factsFor(Object.values(starterThemes));

/**
 * Spin\'s own elements are not the browser\'s, so a project reads them with
 * the `spin` dial — the primitives\' claimed non-native tags.
 */
const SPIN: SemanticOptions = {
  strictness: "strict",
  semanticTags: "spin",
};

/** The classes of an element, as the core reads them. */
function element(
  tag: string,
  classes: string,
  ancestors: readonly AncestorFacts[] = [],
): ClassFacts {
  const names = classes.split(/\s+/).filter(Boolean);
  let at = 0;
  return {
    tag,
    classes: names,
    tokens: names.map((name) => {
      const start = at;
      at += name.length + 1;
      return {
        name,
        range: [start, start + name.length] as [number, number],
        spaceBefore: start > 0,
        spaceAfter: true,
      };
    }),
    ancestors,
    position: { line: 1, column: 1 },
  };
}

/** What the redundancy rule reports for one element. */
function redundant(tag: string, classes: string) {
  return checkNoRedundantClass(facts, element(tag, classes));
}

/** What the theme-value rule reports for one element. */
function override(tag: string, classes: string) {
  return checkPreferThemeValue(facts, element(tag, classes));
}
/** The element rule reports for one element, on spin's own elements. */
function other(tag: string, classes: string) {
  return checkPreferElement(facts, element(tag, classes), SPIN);
}

test("a variant that clears the fill leaves the ink to the author", () => {
  // The bare button has no fill, so the ink the base declares — the ink on
  // the primary fill — is not the button's ink. `text-text` is the author's
  // own answer, and the rule says nothing about it.
  deepStrictEqual(override("button", "bare text-text"), []);
  deepStrictEqual(override("button", "bare text-text-muted"), []);
});

test("the size on an opted-out element is the author's own", () => {
  // The bare button opts out of the button's paint to style itself with
  // utilities: a size there is the author's own decision, not a second
  // opinion about the theme's. Dropping the class would change the page.
  deepStrictEqual(override("button", "bare text-lg"), []);
});

test("a class the variant cleared is not dead weight", () => {
  // The bare variant clears the edge, so `border` is not what the button
  // already says — it is what the variant took away. Dropping it would
  // change the page.
  deepStrictEqual(redundant("button", "bare border"), []);
  // And without the variant the class IS what the element says.
  const [finding] = redundant("button", "border");
  deepStrictEqual(finding?.messageId, "redundant");
  deepStrictEqual(finding?.data["properties"], "border-width, border-style");
});

test("the variant's own answer is dead weight", () => {
  // The secondary button wears `on-secondary`, so `text-on-secondary` says what it
  // already says.
  const [finding] = redundant("button", "secondary text-on-secondary");
  deepStrictEqual(finding?.messageId, "redundant");
  deepStrictEqual(finding?.data, {
    tag: "button",
    cls: "text-on-secondary",
    properties: "color",
  });
});

test("a class that sets what the variant claimed is not a fight", () => {
  // The ghost button has no fill, and a class that puts one back is the
  // variant's own answer or a deliberate override — neither is a second
  // opinion about the base.
  deepStrictEqual(override("button", "ghost bg-primary"), []);
  deepStrictEqual(override("button", "secondary bg-primary"), []);
});

test("the remedy names only the variants that carry the decision", () => {
  // The remedy has to be a way out. A variant that says nothing about the
  // decision the class overrode is not one, and offering it sends the author
  // to a door that does not open.
  const [fill] = override("button", "bg-primary");
  deepStrictEqual(
    renderMessage(RULES["prefer-theme-value"].meta, fill!),
    "`<button>` sets its own fill; `bg-primary` fights it. " +
      "Use a variant (`bare`, `contrast`, …) or the theme's value.",
  );
  // `bare` carries the corner — it zeroes the radius — so it is offered
  // beside the theme's own value; a variant that said nothing about the
  // decision would not be.
  const [corner] = override("button", "rounded-full");
  deepStrictEqual(
    renderMessage(RULES["prefer-theme-value"].meta, corner!),
    "`<button>` sets its own fill; `rounded-full` fights it. " +
      "Use a variant (`bare`) or the theme's value.",
  );
});

test("the remedy never offers a variant the element already wears", () => {
  // The size variant the element wears is the size it is: offering it again
  // is not advice.
  const [worn] = override("button", "s-sm px-3");
  deepStrictEqual(
    renderMessage(RULES["prefer-theme-value"].meta, worn!),
    "the theme owns the space between blocks; `px-3` fights it. " +
      "Use a variant (`s-lg`) or the theme's value.",
  );
});

test("a variant paints the element it belongs to and no other", () => {
  // The secondary variant's selector names the button, so a span that wears
  // the class is not wearing the variant: the rule reads what the element
  // is, and a span is not a button.
  deepStrictEqual(facts.surfaces.variants("button", ["bare", "secondary"]), [
    "bare",
    "secondary",
  ]);
  deepStrictEqual(facts.surfaces.variants("span", ["secondary"]), []);
});

test("a decision the variant claimed is not another element's", () => {
  // The ghost card has no fill, so the ink is not the card's to decide and
  // the rule does not point at the link that carries the link ink.
  deepStrictEqual(other("card", "text-link").length, 1);
  deepStrictEqual(other("card", "card-ghost text-link"), []);
});
