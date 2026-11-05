import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { typographyRules } from "./typography.ts";

/**
 * TYPE-c (styles own type): the `tracking-*`/`leading-*` rules are deleted.
 * What remains is capitalisation + the focus ring as static rules. A removed
 * atom is an unknown class with a style suggestion (see
 * tests/diagnostics/type-suggestions.test.ts), never a silent declaration.
 */

test("the tracking rule is gone", () => {
  const sources = typographyRules().map((entry) =>
    entry[0] instanceof RegExp ? entry[0].source : String(entry[0])
  );
  deepStrictEqual(
    sources.filter((source) => source.includes("tracking")),
    [],
    "no tracking rule may remain",
  );
});

test("the leading rule is gone", () => {
  const sources = typographyRules().map((entry) =>
    entry[0] instanceof RegExp ? entry[0].source : String(entry[0])
  );
  deepStrictEqual(
    sources.filter((source) => source.includes("leading")),
    [],
    "no leading rule may remain",
  );
});

test("capitalisation and the focus ring remain", () => {
  const names = typographyRules().flatMap((entry) =>
    typeof entry[0] === "string" ? [entry[0]] : []
  );
  for (const name of ["uppercase", "lowercase", "capitalize", "outline-none"]) {
    deepStrictEqual(names.includes(name), true, `${name} remains vocabulary`);
  }
});
