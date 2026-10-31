import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const LABELLED = ["basic", "field", "masked", "placeholder", "twofactor"];

test("every labelled example names its field and renders its cells", () => {
  for (const stem of LABELLED) {
    const html = read(stem);
    assert.ok(
      html.includes("getLabelProps()"),
      `${stem} must render the label that names the pin`,
    );
    assert.ok(
      html.includes("getItems()") && html.includes("getInputProps(cell)"),
      `${stem} must iterate one cell input per index`,
    );
    assert.ok(
      html.includes("getHiddenInputProps()"),
      `${stem} must render the hidden input that joins the value`,
    );
  }
});

test("the verification example renders cells without a form label", () => {
  const html = read("verification");
  assert.ok(
    html.includes("getItems()") && html.includes("getInputProps(cell)"),
    "verification must iterate one cell input per index",
  );
  assert.ok(
    html.includes("getHiddenInputProps()"),
    "verification must render the hidden input that joins the value",
  );
});

test("the field example reports the weak pin in error ink", () => {
  const html = read("field");
  assert.ok(
    html.includes("text-semantic-error"),
    "the weak-pin warning must use the semantic error token",
  );
  assert.ok(
    html.includes('show={machine.valueAsString === "1234"}'),
    "the warning must show exactly for the weak pin",
  );
});
