import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("./examples/", import.meta.url);
const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = [
  "basic",
  "equalizer",
  "fractional",
  "marks",
  "range",
  "stepped",
  "ticks",
  "vertical",
];

test("the single-machine specimens bind once; the equalizer binds five", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    const bindings = html.match(/const \w+ = slider\(/g) ?? [];
    const want = stem === "equalizer" ? 5 : 1;
    assert.ok(
      bindings.length === want,
      `${stem} must bind ${want} machine(s): each binding is its own bridge under its own name`,
    );
  }
});

test("the gallery holds the eight specimens", () => {
  const stems = readdirSync(dir)
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.slice(0, -".html".length))
    .sort();
  assert.deepStrictEqual(stems, [...STEMS].sort());
});

test("every example renders the track, the fill, and one thumb per index", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    if (html.includes("<include")) continue;
    assert.ok(
      html.includes("getTrackProps()") && html.includes("getRangeProps()"),
      `${stem} must render the track and its fill`,
    );
    assert.ok(
      html.includes("getThumbIndexes()") &&
        html.includes("getThumbProps(row)"),
      `${stem} must render one thumb per index`,
    );
    assert.ok(
      html.includes("getHiddenInputProps(row)"),
      `${stem} must carry each thumb's value in a hidden input`,
    );
  }
});

test("the marker specimens key their dots on the live value", () => {
  for (const stem of ["marks", "ticks"]) {
    const html = read(stem);
    assert.ok(
      html.includes("getMarkerProps(row)"),
      `${stem} must place one marker per tick`,
    );
    assert.ok(
      html.includes("machine.value[0]"),
      `${stem} must compare each tick against the live value so the dots follow the thumb`,
    );
  }
});
