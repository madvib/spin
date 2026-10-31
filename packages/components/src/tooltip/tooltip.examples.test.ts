import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("./examples/", import.meta.url);
const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = [
  "basic",
  "metrics",
  "positioning",
  "status",
  "video",
  "with-arrow",
];

test("the gallery holds the six specimens", () => {
  const stems = readdirSync(dir)
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.slice(0, -".html".length))
    .sort();
  assert.deepStrictEqual(stems, [...STEMS].sort());
});

test("every specimen renders from the tooltip surface, never a data-variant origin", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      !html.includes("data-[placement"),
      `${stem} must not lean on data-variant classes the preset never emits`,
    );
    assert.ok(
      html.includes("getContentProps"),
      `${stem} must spread the content bag that owns the position`,
    );
  }
});

test("every specimen zeros the UA margin and anchors free of the layout", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    const at = html.indexOf("{...ctl.getContentProps()}");
    assert.ok(at !== -1, `${stem} must spread the content bag`);
    const tag = html.slice(at, html.indexOf(">", at));
    assert.ok(
      tag.includes("fixed m-0"),
      `${stem} must pin the tip to the measured origin, not the UA auto margin`,
    );
  }
});

test("the arrow specimen shows only its two outer edges", () => {
  const html = read("with-arrow");
  assert.ok(
    html.includes("border-b-0 border-r-0 border-l border-t"),
    "with-arrow must open the inner corner so the seam never paints",
  );
});
