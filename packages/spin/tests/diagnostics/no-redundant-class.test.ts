import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { element, facts, other, override, redundant } from "./semantic-helpers.ts";

test("a class that says what the element says is dead weight", () => {
  // The heading's own size is the theme's ladder step, and `text-xl` is
  // that same step. The class changes nothing.
  const [finding] = redundant("h3", "text-xl");
  deepStrictEqual(finding?.messageId, "redundant");
  deepStrictEqual(finding?.data, {
    tag: "h3",
    cls: "text-xl",
    properties: "font-size",
  });
});
test("a dead weight class carries the edit that drops it", () => {
  // The class is dead weight, so dropping it is the whole of the fix — and
  // the fix is part of the finding, so every front end can apply it.
  const [finding] = redundant("code", "font-mono");
  deepStrictEqual(finding?.fix, { range: [0, 10], text: "" });
});

