import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("./examples/", import.meta.url);
const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = [
  "basic",
  "nested",
  "threepanels",
  "vertical",
];

test("the gallery holds the four honest specimens", () => {
  const stems = readdirSync(dir)
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.slice(0, -".html".length))
    .sort();
  assert.deepStrictEqual(stems, [...STEMS].sort());
});

test("no specimen nests a splitter tag the runtime never defines", () => {
  for (const stem of STEMS) {
    assert.ok(
      !read(stem).includes("<spin-splitter"),
      `${stem} must not nest an inert tag: nested machines are script bindings, not tags`,
    );
  }
});

test("the nested specimen binds two splitters and renders one root inside the other", () => {
  const html = read("nested");
  const bindings = html.match(/const \w+ = splitter\(/g) ?? [];
  assert.strictEqual(bindings.length, 2);
  assert.ok(
    html.includes("inner.getRootProps()") && html.includes('show={row.id === "middle"}'),
    "the inner root must render inside the outer middle panel",
  );
});

test("every specimen tints its handles on hover and keyboard focus", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("hover:bg-surface-sunken")
      && html.includes("focus-visible:bg-surface-sunken"),
      `${stem} must show the handle under the pointer and under the keyboard`,
    );
  }
});

test("every specimen sizes its handles along the live orientation", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes('"w-2 cursor-col-resize"') && html.includes('=== "horizontal"')
      && html.includes('"h-2 cursor-row-resize"') && html.includes('=== "vertical"'),
      `${stem} must key handle geometry on the orientation reader`,
    );
  }
});
