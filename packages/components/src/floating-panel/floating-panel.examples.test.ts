import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();


test("every specimen carries the full eight-handle resize frame", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    for (const edge of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
      assert.ok(
        html.includes(`getResizeTriggerProps("${edge}")`),
        `${stem} must wire the ${edge} resize handle`,
      );
    }
  }
});

test("every resize handle zeros the button padding and the bottom corners seat at the edge", () => {
  for (const stem of STEMS) {
    const lines = read(stem)
      .split("\n")
      .filter((line) => line.includes("getResizeTriggerProps"));
    assert.strictEqual(lines.length, 8, `${stem} must render eight handles`);
    for (const line of lines) {
      assert.ok(
        line.includes("bare"),
        `${stem} must zero the button padding or the handle inflates to 32px: ${line.trim().slice(0, 80)}`,
      );
      assert.ok(
        !line.includes("bottom-1") && !line.includes("bottom-2"),
        `${stem} must seat the south handles at the edge, not float above it: ${line.trim().slice(0, 80)}`,
      );
    }
  }
});

test("every specimen dims, shrinks, and clips the closed and minimized stages", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes('"pointer-events-none invisible scale-95 opacity-0": !machine.isOpen'),
      `${stem} must dim and shrink the closed panel`,
    );
    assert.ok(
      html.includes('"h-12 overflow-hidden": machine.stage === "minimized"'),
      `${stem} must clip the minimized panel to its header`,
    );
    assert.ok(
      html.includes('"h-full w-full": machine.stage === "maximized"'),
      `${stem} must fill the stage when maximized`,
    );
  }
});
