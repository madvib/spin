import { test } from "bun:test";
import { deepEqual, equal } from "node:assert/strict";
import { previewKey } from "./preview.ts";

test("withholds the key while the theme text has not arrived", () => {
  equal(previewKey("", "neobrutalist", undefined), undefined);
  equal(previewKey("   ", "neobrutalist", undefined), undefined);
});

test("keys the fetch once text lands", () => {
  const key = previewKey('{"color":{}}', "neobrutalist", undefined, "<div/>");
  deepEqual(key, {
    tree: undefined,
    name: "neobrutalist",
    markup: "<div/>",
    text: '{"color":{}}',
  });
});
