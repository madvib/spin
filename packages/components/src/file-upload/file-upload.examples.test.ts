import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();

test("every example wires the dropzone as a labelled button", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getDropzoneProps()"),
      `${stem} must bind the dropzone contract`,
    );
    assert.ok(
      html.includes("getLabelProps()"),
      `${stem} must render the label the dropzone names`,
    );
    assert.ok(
      html.includes("getHiddenInputProps()"),
      `${stem} must render the input the dropzone opens`,
    );
  }
});

test("every example renders the file rows it accepts", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getAcceptedRows()") && html.includes("getItemProps(row)"),
      `${stem} must list one row per accepted file`,
    );
    assert.ok(
      html.includes("getItemDeleteTriggerProps(row)"),
      `${stem} must offer a delete trigger per row`,
    );
  }
});

test("the paste example names the paste path its dropzone now honors", () => {
  const html = read("paste");
  assert.ok(
    html.toLowerCase().includes("paste"),
    "the paste specimen must promise pasting",
  );
});
