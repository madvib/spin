import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import plugin from "../src/index.ts";
import { engineAnswers } from "@spinjs/preset";
import { starterThemes } from "@spinjs/theme/themes";

/**
 * The rules are the product, so the tests drive them the way oxlint does:
 * `src/index.ts` declares the little of an AST node a rule reads,
 * structurally, and each test hands the rule exactly that much.
 *
 * The vocabulary these tests assert is the vocabulary the themes declare —
 * `bg-primary` pairs with `text-on-primary` because the palette says so. A
 * test here that had to spell its own pairing table would prove the table,
 * not the rule.
 */

interface Report {
  messageId: string;
  data?: Record<string, string>;
}

/** The reports one class list earns, through the rule's own entry point. */
function reportsFor(cls: string): Report[] {
  const rule = plugin.rules["no-unpaired-ink"];
  const reports: Report[] = [];
  const visit = rule.create({
    answers: engineAnswers(Object.values(starterThemes)),
    report(descriptor) {
      reports.push({ messageId: descriptor.messageId, data: descriptor.data });
    },
  }).JSXAttribute;
  visit?.({
    type: "JSXAttribute",
    name: { name: "class" },
    value: { value: cls },
    parent: { type: "JSXOpeningElement", name: { name: "div" } },
  });
  return reports;
}

test("ink on a paired fill must be the ink the palette pairs with it", () => {
  // The mistake this catches: body ink painted on a filled control. The
  // fill's floor is on `on-primary`, so `text-primary` is a pairing nobody
  // validated while the ink the theme measured goes unused.
  const [report] = reportsFor("bg-primary text-primary");
  deepStrictEqual(report?.messageId, "mismatch");
  deepStrictEqual(report?.data, {
    ink: "text-primary",
    fill: "primary",
    expected: "text-on-primary",
  });
});

test("an alias is not the ink the palette declares", () => {
  // `on-danger` is the legacy alias the starters kept for the error fill;
  // the domain's answer is `on-semantic-error`, and two names for one ink is
  // the disagreement the lint exists to stop shipping.
  const [report] = reportsFor("bg-semantic-error text-on-danger");
  deepStrictEqual(report?.messageId, "mismatch");
  deepStrictEqual(report?.data?.["expected"], "text-on-semantic-error");
});

test("a paired ink in the same state settles the fill", () => {
  // The finished pair: the fill with its own ink, and the rule says
  // nothing — in resting or under a state prefix.
  deepStrictEqual(reportsFor("bg-primary text-on-primary"), []);
  deepStrictEqual(reportsFor("hover:bg-accent hover:text-on-accent"), []);
});

test("surfaces are the page, not a fill", () => {
  // Body ink sits on a surface by definition — every floor is measured
  // there — so a sunken panel with no named ink is complete, not missing.
  deepStrictEqual(reportsFor("bg-surface"), []);
  deepStrictEqual(reportsFor("bg-surface-raised"), []);
  deepStrictEqual(reportsFor("bg-surface-sunken"), []);
});

test("two paired fills merged in resting stay silent", () => {
  // A fail-closed guard for the merge the adapters cannot scope: two fills
  // in one static list means either could be the one on screen (a variant
  // group, a pasted pair), so the rule names no pairing rather than the
  // wrong one.
  deepStrictEqual(reportsFor("bg-primary bg-accent"), []);
});

test("a fill and its ink arriving in the same conditional branch pair", () => {
  // A conditional branch is a state the element CAN be in, read with the
  // resting classes: an object key that only renders under a machine state
  // carries its fill and its ink together, so the rule must not read the
  // branch alone and report the fill as inkless.
  const rule = plugin.rules["no-unpaired-ink"];
  const reports: { messageId: string }[] = [];
  const visit = rule.create({
    answers: engineAnswers(Object.values(starterThemes)),
    report(descriptor) {
      reports.push({ messageId: descriptor.messageId });
    },
  }).JSXAttribute;
  visit?.({
    type: "JSXAttribute",
    name: { name: "class" },
    value: {
      type: "JSXExpressionContainer",
      expression: {
        type: "ArrayExpression",
        elements: [
          { type: "Literal", value: "rounded-sm px-1" },
          {
            type: "ObjectExpression",
            properties: [{
              type: "Property",
              key: { type: "Literal", value: "bg-primary text-on-primary" },
              value: { type: "Identifier", name: "active" },
            }],
          },
        ],
      },
    },
    parent: { type: "JSXOpeningElement", name: { name: "span" } },
  });
  deepStrictEqual(reports, []);
});

