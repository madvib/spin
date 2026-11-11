import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import plugin from "../src/index.ts";
import { engineAnswers } from "@spinjs/preset";
import { designLanguages } from "@spinjs/theme";

test("the plugin reads the dial from the linter's context", () => {
  // The option travels through the plugin API the way a linter delivers
  // it: as the rule's first option.
  const rule = plugin.rules["prefer-theme-value"];
  const seen: { messageId: string; data?: Record<string, string> }[] = [];
  const visit = rule.create({
    answers: engineAnswers(Object.values(designLanguages)),
    options: [{ strictness: "balanced" }],
    report(descriptor) {
      seen.push({
        messageId: descriptor.messageId,
        data: descriptor.data,
      });
    },
  }).JSXAttribute;
  visit?.({
    type: "JSXAttribute",
    name: { name: "class" },
    value: { value: "text-sm bg-primary" },
    parent: { type: "JSXOpeningElement", name: { name: "button" } },
  });
  deepStrictEqual(seen.map((report) => report.data?.["cls"]), [
    "bg-primary",
  ]);
});

test("the plugin's rules carry a schema for their options", () => {
  // A linter validates the options against the schema before the rule
  // runs, so the schema is the rule's public contract.
  for (
    const name of ["no-redundant-class", "prefer-theme-value", "prefer-element"]
  ) {
    const rule = plugin.rules[name as keyof typeof plugin.rules];
    deepStrictEqual(rule.meta.schema.length, 1);
  }
});

test("the rules that drop a class say they can", () => {
  // A linter that is told a rule fixes nothing will not apply the edits it
  // is given, so the flag travels with the rule.
  deepStrictEqual(plugin.rules["no-redundant-class"].meta.fixable, "code");
  deepStrictEqual(plugin.rules["closed-vocabulary"].meta.fixable, "code");
  deepStrictEqual(plugin.rules["prefer-theme-value"].meta.fixable, undefined);
  deepStrictEqual(plugin.rules["prefer-element"].meta.fixable, undefined);
});

