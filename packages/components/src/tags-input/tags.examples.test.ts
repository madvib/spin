import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("./examples/", import.meta.url);
const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

test("the gallery holds the two thin specimens", () => {
  const stems = readdirSync(dir)
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.slice(0, -".html".length))
    .sort();
  assert.deepStrictEqual(stems, ["basic", "with-combobox"]);
});

test("the basic example wires the entry field behind its label", () => {
  const html = read("basic");
  assert.ok(
    html.includes("getLabelProps()"),
    "basic must render the label that names the entry",
  );
  assert.ok(
    html.includes("getTags()") && html.includes("getItemProps(row)"),
    "basic must render one row per tag",
  );
  assert.ok(
    html.includes("getItemState(row).highlighted"),
    "basic must key the highlight on the live item state",
  );
  assert.ok(
    html.includes("getItemDeleteTriggerProps(row)") &&
      html.includes("getClearTriggerProps()"),
    "basic must offer per-tag and clear-all deletes",
  );
  assert.ok(
    html.includes("getItemInputProps(row)"),
    "basic must render the inline editor the double-click opens",
  );
});

test("the combobox example seeds the options its glue picks from", () => {
  const html = read("with-combobox");
  assert.ok(
    html.includes("combobox({items:"),
    "with-combobox must seed the collection, or the dropdown is permanently empty and the pick glue never fires",
  );
  assert.ok(
    html.includes("getClearTriggerProps()"),
    "with-combobox must render the clear trigger the glue clicks to reset the field",
  );
});

test("no example pairs bare with a fill width on a block child", () => {
  const attr = ["cl", "ass", "="].join("") + '"';
  for (const stem of ["basic", "with-combobox"]) {
    const html = read(stem);
    for (const chunk of html.split(attr).slice(1)) {
      const classes = chunk.slice(0, chunk.indexOf('"')).split(/\s+/);
      if (classes.includes("bare") && classes.includes("w-full")) {
        assert.fail(
          `${stem} pairs bare with w-full: the bare rule's width:auto beats the utility and the field collapses`,
        );
      }
    }
  }
});
