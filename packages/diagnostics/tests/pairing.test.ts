import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import plugin from "../src/index.ts";
import { engineAnswers } from "@spinjs/preset";
import { designLanguages } from "@spinjs/theme";

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
    answers: engineAnswers(Object.values(designLanguages)),
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
  // `on-danger` is the legacy alias the languages kept for the error fill;
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

test("a thinned fill pairs tone-on-tint, not ink-on-fill", () => {
  // `bg-semantic-success/15` is 15% of the tone over the page: the readable
  // ink is the tone itself, not the `on-` ink measured against the solid
  // fill. A thinned fill asks nothing of the ink beside it — the rule's
  // pairing table covers solid fills only.
  deepStrictEqual(
    reportsFor("bg-semantic-success/15 text-semantic-success"),
    [],
  );
  deepStrictEqual(reportsFor("bg-primary/10 text-primary"), []);
  // The solid fill still pairs: thinning is the exception, not the shape.
  const [report] = reportsFor("bg-primary text-primary");
  deepStrictEqual(report?.messageId, "mismatch");
});

test("surfaces are the page, not a fill", () => {
  // Surface tokens wear any role ink without pairing; pairing fires only on
  // the non-surface fill beside them.
  for (const surface of ["bg-surface", "bg-surface-raised", "bg-surface-sunken"]) {
    deepStrictEqual(
      reportsFor(`${surface} text-primary hover:bg-accent hover:text-primary`),
      [
        {
          messageId: "mismatch",
          data: {
            ink: "text-primary",
            fill: "accent",
            expected: "text-on-accent",
          },
        },
      ],
    );
  }
});

test("two paired fills merged in one state stand down without silencing other states", () => {
  deepStrictEqual(
    reportsFor("bg-primary bg-accent text-primary hover:bg-accent hover:text-primary"),
    [
      {
        messageId: "mismatch",
        data: {
          ink: "text-primary",
          fill: "accent",
          expected: "text-on-accent",
        },
      },
    ],
  );
});

test("bg-transparent clears an earlier fill in its own state only", () => {
  deepStrictEqual(
    reportsFor("bg-primary bg-transparent text-primary hover:bg-accent hover:text-primary"),
    [
      {
        messageId: "mismatch",
        data: {
          ink: "text-primary",
          fill: "accent",
          expected: "text-on-accent",
        },
      },
    ],
  );
  deepStrictEqual(reportsFor("bg-transparent bg-primary text-primary"), [
    {
      messageId: "mismatch",
      data: {
        ink: "text-primary",
        fill: "primary",
        expected: "text-on-primary",
      },
    },
  ]);
});

test("a fill and its ink arriving in the same conditional branch pair", () => {
  // A conditional branch is a state the element CAN be in, read with the
  // resting classes: an object key that only renders under a machine state
  // carries its fill and its ink together, so the rule must not read the
  // branch alone and report the fill as inkless.
  const rule = plugin.rules["no-unpaired-ink"];
  const reports: { messageId: string }[] = [];
  const visit = rule.create({
    answers: engineAnswers(Object.values(designLanguages)),
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

test("co-guarded object keys pair together without crossing distinct guards", () => {
  const rule = plugin.rules["no-unpaired-ink"];
  const reports: Report[] = [];
  const visit = rule.create({
    answers: engineAnswers(Object.values(designLanguages)),
    report(descriptor) {
      reports.push({ messageId: descriptor.messageId, data: descriptor.data });
    },
  }).JSXAttribute;
  visit?.({
    type: "JSXAttribute",
    name: { name: "classList" },
    value: {
      type: "JSXExpressionContainer",
      expression: {
        type: "ObjectExpression",
        properties: [
          {
            type: "Property",
            key: { type: "Literal", value: "bg-primary" },
            value: { type: "Identifier", name: "active" },
          },
          {
            type: "Property",
            key: { type: "Literal", value: "text-primary" },
            value: { type: "Identifier", name: "active" },
          },
          {
            type: "Property",
            key: { type: "Literal", value: "bg-accent" },
            value: { type: "Identifier", name: "other" },
          },
        ],
      },
    },
    parent: { type: "JSXOpeningElement", name: { name: "div" } },
  });
  deepStrictEqual(reports, [
    {
      messageId: "mismatch",
      data: {
        ink: "text-primary",
        fill: "primary",
        expected: "text-on-primary",
      },
    },
  ]);
});

