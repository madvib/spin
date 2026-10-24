import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import plugin from "../src/index.ts";

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
  // fill's floor is on `on-primary`, so `text-text` is a pairing nobody
  // validated while the ink the theme measured goes unused.
  const [report] = reportsFor("bg-primary text-text");
  deepStrictEqual(report?.messageId, "mismatch");
  deepStrictEqual(report?.data, {
    ink: "text-text",
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
  // mode while `text-text` does, so a label on a ramp step is legible in one
  // mode and unreadable in the other, and nothing in the theme said either
  // way.
  const [report] = reportsFor("bg-neutral-700 text-text");
  deepStrictEqual(report?.messageId, "undeclared");
  deepStrictEqual(report?.data, { ink: "text-text", fill: "neutral-700" });
});

test("a fill constrains the ink of its own state", () => {
  // A chip brightens its resting ink on the surface, and the fill that
  // arrives under a pointer is the hover state's business: `hover:bg-accent`
  // does not make the resting `text-text-muted` an unpaired ink, and
  // `hover:text-text` under the same hover fill does.
  deepStrictEqual(
    reportsFor("bg-surface-raised text-text-muted hover:bg-accent"),
    [],
  );
  const [report] = reportsFor("hover:bg-accent hover:text-text");
  deepStrictEqual(report?.messageId, "mismatch");
  deepStrictEqual(report?.data?.["expected"], "text-on-accent");
});
