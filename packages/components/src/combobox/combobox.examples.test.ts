import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("./examples/", import.meta.url);
const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = ["basic", "directory", "grouping", "multiple"];

test("the gallery holds the four distinct specimens", () => {
  const stems = readdirSync(dir)
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.slice(0, -".html".length))
    .sort();
  assert.deepStrictEqual(stems, [...STEMS].sort());
});

test("every example wires the typeahead behind its label", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getLabelProps()"),
      `${stem} must render the label that names the field`,
    );
    assert.ok(
      html.includes("getInputProps()"),
      `${stem} must bind the typeahead input`,
    );
    assert.ok(
      html.includes("getTriggerProps()") &&
        html.includes("getClearTriggerProps()"),
      `${stem} must offer open and clear triggers`,
    );
  }
});

test("every example renders its rows through the live highlight", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getBlocks()") && html.includes("getRows(block)") &&
        html.includes("getItemProps(row)"),
      `${stem} must render one row per option`,
    );
    assert.ok(
      html.includes("machine.highlightedValue === row.value"),
      `${stem} must light the highlight from the live reader against the stable row key`,
    );
    assert.ok(
      html.includes("machine.value.includes(row.value)"),
      `${stem} must mark committed rows from the live value`,
    );
  }
});

test("the multiple example reads out its committed selections", () => {
  const html = read("multiple");
  assert.ok(
    html.includes("multiple: true"),
    "multiple must run the machine in multiple mode",
  );
  assert.ok(
    html.includes("machine.valueAsString"),
    "multiple must render the committed selections: the field holds only the typed text",
  );
});

test("the directory example names the search it performs", () => {
  const html = read("directory");
  assert.ok(
    html.includes("placeholder="),
    "directory must hint the directory search in its field",
  );
});
