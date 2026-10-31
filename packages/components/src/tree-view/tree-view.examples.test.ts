import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("./examples/", import.meta.url);
const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");


test("every example iterates its visible rows through the live state", () => {
  for (const stem of ["basic", "loading"]) {
    const html = read(stem);
    assert.ok(
      html.includes("getLabelProps()"),
      `${stem} must render the label the tree names`,
    );
    assert.ok(
      html.includes("getVisibleRows()") &&
        html.includes("getBranchControlProps(row)"),
      `${stem} must render one control per visible row`,
    );
    assert.ok(
      html.includes("getItemState(row).selected") &&
        html.includes("getItemState(row).expanded"),
      `${stem} must read selection and expansion from the live item state`,
    );
  }
});

test("the loading example renders the spinner the lazy load shows", () => {
  const html = read("loading");
  assert.ok(
    html.includes("getLoadingProps(row)"),
    "loading must render the marker the machine shows while children load",
  );
});
