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
  // `tracking-tight` on a span is the single-owner error the element rule
  // exists to report — until the author marks the element deliberate.
  // TYPE-b: the raw size the fixture wore is a vocabulary warning now, so
  // the ownership legs wear the surviving single-owner carriers.
  deepStrictEqual(checkPreferElement(facts, element("span", "tracking-tight")).length > 0, true);
  deepStrictEqual(checkPreferElement(facts, escaped("span", "tracking-tight")), []);
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
  deepStrictEqual(checkPreferElement(facts, element("span", "tracking-tight")).length > 0, true);
  deepStrictEqual(checkPreferThemeValue(facts, element("h3", "type-body")).length > 0, true);
});

test("the wordmark's lockup is expressible through the escape", () => {
  // The brand wordmark's tight tracking on a span is a single-owner
  // typographic reach the element rule reports. Through the escape it stands
  // down; the vocabulary still holds (the tracking is one the theme
  // produces). TYPE-b: the wordmark's raw face/weight legs are removed
  // utilities now — the migration rounds own that markup; the escape leg
  // that survives is the tracking.
  const wordmark = escaped("span", "tracking-tight");
  deepStrictEqual(checkPreferElement(facts, wordmark), []);
  deepStrictEqual(checkPreferThemeValue(facts, wordmark), []);
  deepStrictEqual(checkClosedVocabulary(facts, wordmark), []);
});

/** A JSX attribute node, with the parent element carrying the given attributes. */
function gateAttribute(
  classValue: string,
  parentAttributes: readonly { name: string }[],
): GateNode {
  const parent = {
    type: "JSXOpeningElement",
    name: { name: "span" },
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

function ruleFindings(node: GateNode): string[] {
  const out: string[] = [];
  RULES["prefer-element"].create({
    report: (descriptor) => {
      out.push(descriptor.messageId);
    },
  }).JSXAttribute(node);
  return out;
}

test("the linter recognizes the escape on the element", () => {
  // The recognition every adapter shares: the class attribute's own element
  // carries `data-spin-escape`, so the element rule stands down.
  const bare = gateAttribute("tracking-tight", []);
  deepStrictEqual(ruleFindings(bare), ["error"]);
  const marked = gateAttribute("tracking-tight", [{ name: "data-spin-escape" }]);
  deepStrictEqual(ruleFindings(marked), []);
});

test("a misspelled escape is no escape", () => {
  // There is one spelling and it is exact: a near-miss names nothing the
  // lint reads, so the finding stays.
  const typo = gateAttribute("tracking-tight", [{ name: "data-spin-escp" }]);
  deepStrictEqual(ruleFindings(typo), ["error"]);
  const valued = gateAttribute("tracking-tight", [{ name: "data-escape" }]);
  deepStrictEqual(ruleFindings(valued), ["error"]);
});

test("the escape on another element excuses nothing here", () => {
  // The escape never inherits: it excuses the element that carries it, not
  // its children, not its siblings. A bare element beside an escaped one is
  // still read in full.
  const bare = gateAttribute("tracking-tight", []);
  deepStrictEqual(ruleFindings(bare), ["error"]);
});

test("the escape holds end to end through ESLint", () => {
  // The delivery, not just the check: the real ESLint linter over real
  // source, with the escape attribute on the element.
  const linter = new Linter({ configType: "flat" });
  const config: Linter.Config = {
    files: ["**/*.jsx"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { spin: eslintPlugin },
    rules: { "spin/prefer-element": "error" },
  };
  const flagged = linter.verify(
    `<span className="tracking-tight" />`,
    config,
    "app.jsx",
  );
  deepStrictEqual(flagged.map((message) => message.messageId), ["error"]);
  const excused = linter.verify(
    `<span data-spin-escape className="tracking-tight" />`,
    config,
    "app.jsx",
  );
  deepStrictEqual(excused.map((message) => message.messageId), []);
  const misspelled = linter.verify(
    `<span data-spin-escp className="tracking-tight" />`,
    config,
    "app.jsx",
  );
  deepStrictEqual(misspelled.map((message) => message.messageId), ["error"]);
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
