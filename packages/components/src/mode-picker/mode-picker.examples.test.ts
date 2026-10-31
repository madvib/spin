import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = ["basic", "minimal", "pill"];

test("every example cycles through the trigger part", () => {
  for (const stem of STEMS) {
    assert.ok(
      read(stem).includes("getTriggerProps()"),
      `${stem} example must bind getTriggerProps so the button cycles modes`,
    );
  }
});

test("every example shows exactly one icon per state", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    const gates = html.match(/show=\{/g) ?? [];
    deepStrictEqual(
      gates.length,
      3,
      `${stem} example must gate three icons, found ${gates.length}`,
    );
    for (const icon of ["sun", "moon", "monitor"]) {
      assert.ok(
        html.includes(`i-lucide-${icon}`),
        `${stem} example must carry the ${icon} icon`,
      );
    }
  }
});

test("every example clamps its icons to the resolved mode when single", () => {
  for (const stem of STEMS) {
    assert.ok(
      read(stem).includes("machine.singleMode ? machine.resolvedMode"),
      `${stem} example must depict the resolved mode when there is nothing to pick`,
    );
  }
});

test("every example dims the trigger when disabled", () => {
  for (const stem of STEMS) {
    assert.ok(
      read(stem).includes('"opacity-50 cursor-not-allowed": machine.disabled'),
      `${stem} example must dim the dead trigger`,
    );
  }
});

test("minimal hides on single-mode themes", () => {
  assert.ok(
    read("minimal").includes("hideWhenSingle: true"),
    "minimal example must pass hideWhenSingle so it vanishes when there is nothing to pick",
  );
});

test("pill names the mode it wears", () => {
  const html = read("pill");
  assert.ok(
    html.includes("getLabelProps()"),
    "pill example must bind getLabelProps so the choice is visible text",
  );
  assert.ok(
    html.includes("{machine.singleMode ? machine.resolvedMode : machine.value}"),
    "pill example must render the worn mode, clamped to resolved when single",
  );
});
