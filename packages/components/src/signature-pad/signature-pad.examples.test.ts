import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();

test("every example renders the in-progress stroke while drawing", () => {
  for (const stem of STEMS) {
    assert.ok(
      read(stem).includes("show={machine.drawing}"),
      `${stem} example must render the live stroke or drawing is blind until release`,
    );
    assert.ok(
      read(stem).includes("machine.currentPath"),
      `${stem} example must bind the live stroke to currentPath`,
    );
  }
});

test("every example hides its guide once ink lands", () => {
  for (const stem of STEMS) {
    assert.ok(
      read(stem).includes("show={machine.empty && !machine.drawing}"),
      `${stem} example must gate its guide on empty-and-idle`,
    );
  }
});

test("every example hides its clear trigger on an empty pad", () => {
  for (const stem of STEMS) {
    assert.ok(
      read(stem).includes("show={!machine.empty && !machine.drawing}"),
      `${stem} example must gate its clear trigger on committed ink`,
    );
  }
});

test("with-preview renders the committed strokes reactively", () => {
  const html = read("with-preview");
  assert.ok(
    html.includes("show={!machine.empty}"),
    "with-preview must show its preview block once ink lands",
  );
  assert.ok(
    html.includes("Signature Preview"),
    "with-preview must keep its preview heading",
  );
  assert.ok(
    !html.includes("data-preview"),
    "with-preview must not carry undriven preview hooks",
  );
});
