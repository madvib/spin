import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("./examples/", import.meta.url);
const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

test("the gallery holds the single thin specimen", () => {
  const stems = readdirSync(dir)
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.slice(0, -".html".length))
    .sort();
  assert.deepStrictEqual(stems, ["basic"]);
});

test("the basic example opens the levels from its trigger", () => {
  const html = read("basic");
  assert.ok(
    html.includes("getTriggerProps()"),
    "basic must bind the trigger that opens the panel",
  );
  assert.ok(
    html.includes("getValueTextRows()"),
    "basic must read the committed path for the trigger readout",
  );
  assert.ok(
    html.includes("getClearTriggerProps()"),
    "basic must offer the clear trigger",
  );
});

test("the basic example renders one list per level it reaches", () => {
  const html = read("basic");
  assert.ok(
    html.includes("getLevels()") && html.includes("getListProps(level)"),
    "basic must render one list per drilled level",
  );
  assert.ok(
    html.includes("getItems(level)") && html.includes("getItemProps(row)"),
    "basic must render one row per node in each level",
  );
  assert.ok(
    html.includes("getHiddenInputProps()"),
    "basic must carry the committed value in a hidden input",
  );
});
