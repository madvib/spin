import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = ["basic", "movie", "product-review", "service-evaluation"];

test("every example binds the label its radiogroup names", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getLabelProps()"),
      `${stem} must render the label the control's aria-labelledby resolves`,
    );
  }
});

test("every example iterates its stars through the live item state", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getItems()") && html.includes("getItemProps(row)"),
      `${stem} must render one radio per item`,
    );
    assert.ok(
      html.includes("getItemState(row).highlighted"),
      `${stem} must key the lit stars on the live highlight`,
    );
    assert.ok(
      html.includes("getHiddenInputProps()"),
      `${stem} must render the hidden input that carries the value`,
    );
  }
});
