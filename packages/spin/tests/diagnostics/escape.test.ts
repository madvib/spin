import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { Linter } from "eslint";
import {
  checkClosedVocabulary,
  checkNoRedundantClass,
  checkNoUnpairedInk,
  checkPreferElement,
  checkPreferThemeValue,
  type ClassFacts,
} from "../../src/diagnostics/core.ts";
import eslintPlugin from "../../src/diagnostics/eslint.ts";
import { RULES, type GateNode } from "../../src/diagnostics/rules.ts";
import { element, facts } from "./semantic-helpers.ts";

/**
 * The blessed escape: `data-spin-escape`.
 *
 * One shape, on purpose narrow. The escape is an author's explicit word on
 * the element itself — a third-party override or one-off display type
 * (the brand wordmark) the theme cannot name. The ownership rules stand
 * down for that element; the rules that keep dead classes out do not,
 * because deliberate code still names nothing dead. The escape never
 * inherits: each element opts in for its own classes.
 */

function escaped(tag: string, classes: string): ClassFacts {
  return { ...element(tag, classes), escaped: true };
}

test("the escape stands the ownership rules down", () => {
  // `type-display` on a heading is the second-opinion error the theme rule
  // exists to report — until the author marks the element deliberate.
  // TYPE-c: the legs wear surviving carriers now that the tracking atoms
  // are removed (a removed atom is unknown, not owned).
  deepStrictEqual(checkPreferThemeValue(facts, element("h3", "type-display")).length > 0, true);
  deepStrictEqual(checkPreferThemeValue(facts, escaped("h3", "type-display")), []);
  deepStrictEqual(checkPreferThemeValue(facts, escaped("h3", "type-body")), []);
  deepStrictEqual(checkNoRedundantClass(facts, escaped("p", "type-body")), []);
  deepStrictEqual(checkNoUnpairedInk(facts, escaped("span", "bg-primary")), []);
});

test("the escape leaves the closed vocabulary on", () => {
  // Deliberate code still names nothing dead: a class no theme produces is
  // reported on an escaped element the same as anywhere else — including a
  // removed raw utility, which is unknown with a style suggestion. A class
  // the theme produces stays silent.
  deepStrictEqual(
    checkClosedVocabulary(facts, escaped("span", "not-a-class")).map((finding) => finding.messageId),
    ["unknown"],
  );
  deepStrictEqual(
    checkClosedVocabulary(facts, escaped("span", "text-3xl")).map((finding) => finding.messageId),
    ["unknown"],
  );
  deepStrictEqual(
    checkClosedVocabulary(facts, escaped("span", "type-body")).map((finding) => finding.messageId),
    [],
  );
});

test("without the escape, the ownership rules still fire", () => {
  // The escape is opt-out, not default: an unmarked element gets every rule.
  // TYPE-c legs: surviving carriers (a removed atom is unknown, not owned).
  deepStrictEqual(checkPreferThemeValue(facts, element("h3", "type-display")).length > 0, true);
  deepStrictEqual(checkPreferThemeValue(facts, element("h3", "type-body")).length > 0, true);
});

test("a removed atom is unknown even through the escape", () => {
  // TYPE-c (styles own type): `tracking-tight` is no longer vocabulary, so
  // the closed vocabulary reports it on an escaped element the same as
  // anywhere else — with the style suggestion. The ownership rules stand
  // down, but the dead-class rule does not.
  const wordmark = escaped("span", "tracking-tight");
  deepStrictEqual(checkPreferElement(facts, wordmark), []);
  deepStrictEqual(checkPreferThemeValue(facts, wordmark), []);
  const [finding] = checkClosedVocabulary(facts, wordmark);
  deepStrictEqual(finding?.messageId, "unknown");
  deepStrictEqual((finding?.remedy ?? "").includes("type-"), true);
});

/** A JSX attribute node, with the parent element carrying the given attributes. */
function gateAttribute(
  classValue: string,
  parentAttributes: readonly { name: string }[],
  tag = "span",
): GateNode {
  const parent = {
    type: "JSXOpeningElement",
    name: { name: tag },
    attributes: [
      ...parentAttributes.map((attribute) => ({
        type: "JSXAttribute",
        name: { name: attribute.name },
      })),
      {
        type: "JSXAttribute",
        name: { name: "class" },
        value: { type: "Literal", value: classValue },
      },
    ],
  };
  return {
    type: "JSXAttribute",
    name: { name: "class" },
    value: { type: "Literal", value: classValue },
    parent: parent as unknown as GateNode["parent"],
    loc: { start: { line: 1, column: 0 } },
  };
}

function themeFindings(node: GateNode): string[] {
  const out: string[] = [];
  RULES["prefer-theme-value"].create({
    report: (descriptor) => {
      out.push(descriptor.messageId);
    },
  }).JSXAttribute(node);
  return out;
}

test("the linter recognizes the escape on the element", () => {
  // The recognition every adapter shares: the class attribute's own element
  // carries `data-spin-escape`, so the theme rule stands down. TYPE-c legs:
  // a surviving owned carrier (a removed atom is unknown, not owned).
  const bare = gateAttribute("type-display", [], "h3");
  deepStrictEqual(themeFindings(bare).length > 0, true);
  const marked = gateAttribute("type-display", [{ name: "data-spin-escape" }], "h3");
  deepStrictEqual(themeFindings(marked), []);
});

test("a misspelled escape is no escape", () => {
  // There is one spelling and it is exact: a near-miss names nothing the
  // lint reads, so the finding stays.
  const typo = gateAttribute("type-display", [{ name: "data-spin-escp" }], "h3");
  deepStrictEqual(themeFindings(typo).length > 0, true);
  const valued = gateAttribute("type-display", [{ name: "data-escape" }], "h3");
  deepStrictEqual(themeFindings(valued).length > 0, true);
});

test("the escape on another element excuses nothing here", () => {
  // The escape never inherits: it excuses the element that carries it, not
  // its children, not its siblings. A bare element beside an escaped one is
  // still read in full.
  const bare = gateAttribute("type-display", [], "h3");
  deepStrictEqual(themeFindings(bare).length > 0, true);
});

test("the escape holds end to end through ESLint", () => {
  // The delivery, not just the check: the real ESLint linter over real
  // source, with the escape attribute on the element. TYPE-c legs: the
  // theme rule over a surviving carrier.
  const linter = new Linter({ configType: "flat" });
  const config: Linter.Config = {
    files: ["**/*.jsx"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { spin: eslintPlugin },
    rules: { "spin/prefer-theme-value": "error" },
  };
  const flagged = linter.verify(
    `<h3 className="type-display" />`,
    config,
    "app.jsx",
  );
  deepStrictEqual(flagged.length > 0, true);
  const excused = linter.verify(
    `<h3 data-spin-escape className="type-display" />`,
    config,
    "app.jsx",
  );
  deepStrictEqual(excused.map((message) => message.messageId), []);
  const misspelled = linter.verify(
    `<h3 data-spin-escp className="type-display" />`,
    config,
    "app.jsx",
  );
  deepStrictEqual(misspelled.length > 0, true);
  const vocab = linter.verify(
    `<span data-spin-escape className="not-a-class" />`,
    {
      ...config,
      rules: { "spin/closed-vocabulary": "error" },
    },
    "app.jsx",
  );
  deepStrictEqual(vocab.map((message) => message.messageId), ["unknown"]);
});
