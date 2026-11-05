import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { typographyRules } from "./typography.ts";

function handler() {
  const rules = typographyRules();
  const rule = rules.find((entry) =>
    entry[0] instanceof RegExp && entry[0].source === "^leading-(.+)$"
  );
  assert(rule !== undefined, "the leading rule is registered");
  return rule[1] as (
    match: string[],
    ctx?: unknown,
  ) => Record<string, string> | undefined;
}

test("a custom leading step resolves through the theme", () => {
  const run = handler();
  deepStrictEqual(run(["leading-tight", "tight"], {
    theme: { "font-leading-tight": "var(--font-leading-tight)" },
  }), { "line-height": "var(--font-leading-tight)" });
});

test("a silent theme falls back to the conventional step", () => {
  const run = handler();
  deepStrictEqual(run(["leading-tight", "tight"], { theme: {} }), {
    "line-height": "1.25",
  });
});

test("an undeclared step resolves to nothing", () => {
  const run = handler();
  deepStrictEqual(
    run(["leading-foo", "foo"], { theme: {} }),
    undefined,
  );
});
