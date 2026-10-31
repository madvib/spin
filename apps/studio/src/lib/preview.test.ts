import { test } from "bun:test";
import { deepEqual, equal } from "node:assert/strict";
import { previewKey } from "./preview.ts";

test("withholds the key while the theme text has not arrived", () => {
  equal(previewKey("", "neobrut", undefined), undefined);
  equal(previewKey("   ", "neobrut", undefined), undefined);
});

test("keys the fetch once text lands", () => {
  const key = previewKey('{"color":{}}', "neobrut", undefined, "<div/>");
  deepEqual(key, {
    tree: undefined,
    name: "neobrut",
    markup: "<div/>",
    text: '{"color":{}}',
  });
});
