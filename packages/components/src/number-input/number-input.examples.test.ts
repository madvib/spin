import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = [
  "basic",
  "currency",
  "decimal",
  "limits",
  "percentage",
  "quantity",
  "scrubber",
  "wheel",
];

test("every example wires the spinbutton behind its label", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getLabelProps()"),
      `${stem} must render the label that names the field`,
    );
    assert.ok(
      html.includes("getInputProps()"),
      `${stem} must bind the spinbutton contract`,
    );
    assert.ok(
      html.includes("getDecrementTriggerProps()") &&
        html.includes("getIncrementTriggerProps()"),
      `${stem} must offer both spin triggers`,
    );
  }
});

test("every example reads the live value, never a static copy", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("{machine.value}"),
      `${stem} must render the value reader so spins show`,
    );
  }
});

test("the scrub specimens bind the rail and its cursor", () => {
  for (const stem of ["basic", "scrubber"]) {
    const html = read(stem);
    assert.ok(
      html.includes("getScrubberProps()"),
      `${stem} must bind the scrub rail`,
    );
    assert.ok(
      html.includes("getCursorProps()"),
      `${stem} must render the cursor the rail places`,
    );
  }
});
