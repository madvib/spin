import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const GATED = [
  "basic",
  "doubleclick",
  "inline-edit",
  "profile-field",
  "task-item",
  "title-editor",
  "with-controls",
];

test("every example gates exactly one part per mode", () => {
  for (const stem of GATED) {
    const html = read(stem);
    assert.ok(
      html.includes("show={!machine.editing}") &&
        html.includes("getPreviewProps()"),
      `${stem} must show the preview only while previewing`,
    );
    assert.ok(
      html.includes("show={machine.editing}") &&
        html.includes("getInputProps()"),
      `${stem} must show the input only while editing`,
    );
  }
});

test("the auto-resize example stacks both parts in one grid cell", () => {
  const html = read("resize");
  assert.ok(
    html.includes("relative grid"),
    "the resize area must be a grid so both parts share a cell",
  );
  assert.ok(
    html.includes("col-start-1 row-start-1"),
    "both parts must name the same cell",
  );
  assert.ok(
    html.includes('"invisible": machine.editing'),
    "the sizing preview must turn invisible while editing",
  );
  assert.ok(
    !html.includes("show={!machine.editing}"),
    "gating the preview would collapse the stack the input sizes against",
  );
});
