import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

test("workout example renders separators between units", () => {
  const html = read("workout");
  assert.ok(
    html.includes("getSeparatorProps"),
    "workout example must use getSeparatorProps for unit separators",
  );
  assert.ok(
    html.includes("getSeparatorProps({ after: unit.type, last: unit.last })"),
    "workout example must pass after/last to getSeparatorProps",
  );
});

test("every controlled example wires resume", () => {
  for (const stem of ["basic", "card", "compact", "countdown", "labels", "large", "pomodoro", "workout"]) {
    assert.ok(
      read(stem).includes('getActionTriggerProps({ action: "resume" })'),
      `${stem} example must wire a resume trigger so pause is reversible`,
    );
  }
});

test("card example renders the progress fill", () => {
  assert.ok(
    read("card").includes("getProgressProps"),
    "card example must render getProgressProps so the run's fraction is visible",
  );
});

test("every unit display separates its units", () => {
  for (const stem of ["basic", "card", "countdown", "labels", "large", "pomodoro", "workout"]) {
    assert.ok(
      read(stem).includes("getSeparatorProps({ after: unit.type, last: unit.last })"),
      `${stem} example must separate units with after/last separators`,
    );
  }
});