import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { scaleClass } from "../../src/compiler/reference/build.ts";

/**
 * `scaleClass` is the inverse of the split `buildScale` performs.
 *
 * `buildScale` reads `px-4` as the axis `x` on the prefix `p`, so the axis is
 * the SUFFIX of the prefix. Writing it back as a segment (`p-x-4`) names a
 * utility no rule matches, which left a scale's preview unstyled the moment
 * an edge other than `all` was chosen.
 */
test("scaleClass writes an axis back as the suffix of the prefix", () => {
  deepStrictEqual(scaleClass("p", "", "4"), "p-4");
  deepStrictEqual(scaleClass("p", "x", "4"), "px-4");
  deepStrictEqual(scaleClass("p", "t", "8"), "pt-8");
  deepStrictEqual(scaleClass("p", "l", "1"), "pl-1");
  deepStrictEqual(scaleClass("gap", "", "2"), "gap-2");
});
