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


test("every example renders its groups and rows through the live state", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getLabelProps()"),
      `${stem} must render the label the listbox names`,
    );
    assert.ok(
      html.includes("getBlocks()") && html.includes("getRows(block)") &&
        html.includes("getItemProps(row)"),
      `${stem} must render one row per option`,
    );
    assert.ok(
      html.includes("data-[highlighted]") &&
        html.includes("aria-[selected=true]") &&
        !html.includes("getItemState"),
      `${stem} must light the highlight and the committed pick from the live attributes, never the row snapshot`,
    );
  }
});

test("seeded examples pass real arrays, never encoded strings", () => {
  for (const stem of ["controlled", "icons", "multiple", "settings"]) {
    const html = read(stem);
    assert.ok(
      html.includes("value: ["),
      `${stem} must seed the value as an array: the script calls the factory directly, so a string is a parsing bug waiting to happen`,
    );
  }
});

test("the icons example shows one glyph per row", () => {
  const html = read("icons");
  assert.ok(
    html.includes("i-lucide-frame") && html.includes("i-lucide-code"),
    "icons must render per-row glyphs, or the name promises what the specimen does not show",
  );
});
