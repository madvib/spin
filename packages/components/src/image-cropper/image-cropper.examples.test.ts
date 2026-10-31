import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("./examples/", import.meta.url);
const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();


test("each specimen draws the shape it seeds", () => {
  const rect = read("basic");
  assert.ok(
    !rect.includes('cropShape: "circle"'),
    "basic must seed the default rect shape",
  );
  const circle = read("circle");
  assert.ok(
    circle.includes('cropShape: "circle"'),
    "circle must seed the circle shape",
  );
  assert.ok(
    circle.includes("rounded-full"),
    "circle must draw a round selection for its round seed",
  );
});

test("every specimen renders all eight grips through the handle bag", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("for={machine.handles}"),
      `${stem} must iterate the handle reader`,
    );
    assert.ok(
      html.includes("getHandleProps({ position: row })"),
      `${stem} must place each grip through the bag that positions it`,
    );
  }
});
