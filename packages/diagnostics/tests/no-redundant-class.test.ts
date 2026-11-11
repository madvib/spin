import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { redundant } from "./semantic-helpers.ts";

test("a class that says what the element says is dead weight", () => {
  // The paragraph's own style is the body's tuple, and `type-body` is that
  // same tuple. The class changes nothing. TYPE-b: the element's own style
  // is the same-value case raw sizes used to carry.
  const [finding] = redundant("p", "type-body");
  deepStrictEqual(finding?.messageId, "redundant");
  deepStrictEqual(finding?.data, {
    tag: "p",
    cls: "type-body",
    properties: "font-family, font-size, font-weight, letter-spacing, line-height",
  });
});
test("a dead weight class carries the edit that drops it", () => {
  // The class is dead weight, so dropping it is the whole of the fix — and
  // the fix is part of the finding, so every front end can apply it.
  const [finding] = redundant("p", "type-body");
  deepStrictEqual(finding?.fix, { range: [0, 10], text: "" });
});

