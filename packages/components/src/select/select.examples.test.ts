import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("./examples/", import.meta.url);
const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();


test("every authored example opens its list from the trigger", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    if (html.includes("<include")) continue;
    assert.ok(
      html.includes("getSelectedRows()"),
      `${stem} must iterate the committed rows for the trigger readout`,
    );
    assert.ok(
      html.includes("getRows()") && html.includes("getItemProps(row)"),
      `${stem} must render one row per option`,
    );
  }
});

test("the theme example reuses the basic markup", () => {
  const html = read("theme");
  assert.ok(
    html.includes('<include file="./basic.html"'),
    "theme must include the basic markup",
  );
});
