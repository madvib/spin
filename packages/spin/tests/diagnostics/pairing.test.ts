import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import plugin from "../../src/diagnostics/index.ts";

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

test("a fill that declares no ink flags the ink painted on it", () => {
  // The ramp is steps without foregrounds: a step does not flip with the
  // mode while body ink does, so a label on a ramp step is legible in one
  // mode and unreadable in the other, and nothing in the theme said either
  // way.
  const [report] = reportsFor("bg-neutral-700 text-primary");
  deepStrictEqual(report?.messageId, "undeclared");
  deepStrictEqual(report?.data, { ink: "text-primary", fill: "neutral-700" });
});
test("a fill with no ink names the paired ink as the remedy", () => {
  // The absence this stage exists for: a filled badge with no ink inherits
  // the page's, legible in one theme and dark-on-dark in the next. The
  // finding names the pairing the palette declares, not a guess.
  const [report] = reportsFor("bg-primary");
  deepStrictEqual(report?.messageId, "absence");
  deepStrictEqual(report?.data, { fill: "primary", expected: "text-on-primary" });
});

test("a fill from every family fires with its own paired ink", () => {
  // The pairing table is the theme's, not one fill's: each family that
  // declares a foreground names it when the ink is missing.
  for (
    const [fill, expected] of [
      ["bg-accent", "text-on-accent"],
      ["bg-secondary", "text-on-secondary"],
      ["bg-semantic-error", "text-on-semantic-error"],
      ["bg-semantic-success", "text-on-semantic-success"],
      ["bg-semantic-warning", "text-on-semantic-warning"],
      ["bg-semantic-info", "text-on-semantic-info"],
    ] as const
  ) {
    const [report] = reportsFor(fill);
    deepStrictEqual(report?.messageId, "absence", fill);
    deepStrictEqual(report?.data, { fill: fill.slice(3), expected }, fill);
  }
});

test("absence is per state: a resting ink does not cover a hover fill", () => {
  // The states are different paintings: the resting ink sits on the surface
  // while the hover fill arrives under the pointer with nothing on it.
  const [report] = reportsFor("bg-surface-raised text-text-muted hover:bg-accent");
  deepStrictEqual(report?.messageId, "absence");
  deepStrictEqual(report?.data, { fill: "accent", expected: "text-on-accent" });
});

test("a paired ink in the same state settles the fill", () => {
  // The positive control beside the absence: the same fill with its own ink
  // is the finished pair, and the rule says nothing.
  deepStrictEqual(reportsFor("bg-primary text-on-primary"), []);
  deepStrictEqual(reportsFor("hover:bg-accent hover:text-on-accent"), []);
});

test("an explicitly unpainted box opts out state by state", () => {
  // The designed opt-out: `bg-transparent` in the same state says the fill
  // is not there. An overlay that clears its resting paint still owes its
  // hover ink, and a hover-only opt-out does not excuse a missing resting
  // one — which is why the spelling is a class in the same state, not a
  // comment the lint cannot scope.
  deepStrictEqual(reportsFor("bg-primary bg-transparent"), []);
  deepStrictEqual(reportsFor("hover:bg-accent hover:bg-transparent"), []);
  const [resting] = reportsFor("bg-primary hover:bg-transparent");
  deepStrictEqual(resting?.messageId, "absence");
  deepStrictEqual(resting?.data, { fill: "primary", expected: "text-on-primary" });
  const [hover] = reportsFor("bg-primary bg-transparent hover:bg-accent");
  deepStrictEqual(hover?.messageId, "absence");
  deepStrictEqual(hover?.data, { fill: "accent", expected: "text-on-accent" });
});

test("surfaces are the page, not a fill", () => {
  // Body ink sits on a surface by definition — every floor is measured
  // there — so a sunken panel with no named ink is complete, not missing.
  deepStrictEqual(reportsFor("bg-surface"), []);
  deepStrictEqual(reportsFor("bg-surface-raised"), []);
  deepStrictEqual(reportsFor("bg-surface-sunken"), []);
});

test("a fill the palette gives no ink to stays undeclared, not absent", () => {
  // A ramp step has steps without foregrounds, so there is no pairing to
  // name: the finding says the palette is silent, whether the element
  // names an ink or names none.
  const [missing] = reportsFor("bg-neutral-700");
  deepStrictEqual(missing?.messageId, "undeclared");
  deepStrictEqual(missing?.data, { ink: "none", fill: "neutral-700" });
  const [stated] = reportsFor("bg-neutral-700 text-primary");
  deepStrictEqual(stated?.messageId, "undeclared");
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

test("a bare box names its paired ink explicitly", () => {
  // T5's recorded answer: `bare` strips the element rule, so the fill the
  // author paints is a utility fill like any other — missing ink is
  // flaggable with the pairing remedy, and the paired ink is clean.
  const [report] = reportsFor("bare bg-primary");
  deepStrictEqual(report?.messageId, "absence");
  deepStrictEqual(report?.data, { fill: "primary", expected: "text-on-primary" });
  deepStrictEqual(reportsFor("bare bg-primary text-on-primary"), []);
});
