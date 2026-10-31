import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();

test("every example mounts the shared calendar", () => {
  // `appointment` is the shared calendar itself, not a consumer of it.
  for (const stem of STEMS.filter((stem) => stem !== "appointment")) {
    assert.ok(
      read(stem).includes('<include file="./appointment.html" />'),
      `${stem} must include the shared calendar so one fix heals all grids`,
    );
  }
});

test("the calendar styles cells from live attributes, never the row snapshot", () => {
  const html = read("appointment");
  for (const variant of [
    "data-[selected]",
    "data-[in-range]",
    "aria-[disabled=true]",
    "data-[outside]",
  ]) {
    assert.ok(
      html.includes(variant),
      `the cell class must style ${variant} from the live attribute`,
    );
  }
  for (const stale of [
    "getCellState",
    "cell.selected",
    "cell.inRange",
    "cell.disabled",
    "cell.outside",
  ]) {
    assert.ok(
      !html.includes(stale),
      `the row object is a snapshot: ${stale} would freeze the grid`,
    );
  }
});

test("the grid carries no static columns: the bag owns the shape", () => {
  const html = read("appointment");
  assert.ok(
    !html.includes("grid-cols-"),
    "static columns would freeze the month and year views at seven",
  );
});
