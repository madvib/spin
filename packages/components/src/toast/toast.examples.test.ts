import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("./examples/", import.meta.url);
const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = [
  "action",
  "basic",
  "bottomcenter",
  "bottomleft",
  "bottomright",
  "duration",
  "promise",
  "topcenter",
  "topleft",
  "topright",
  "types",
  "updatable",
];

test("the gallery holds the twelve specimens", () => {
  const stems = readdirSync(dir)
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.slice(0, -".html".length))
    .sort();
  assert.deepStrictEqual(stems, [...STEMS].sort());
});

test("every renderable group spans edge to edge without padding", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    const at = html.indexOf("{...machine.getGroupProps()}");
    if (at === -1) continue; // updatable includes the promise render
    const start = html.lastIndexOf("<div", at);
    const tag = html.slice(start, html.indexOf(">", at));
    assert.ok(
      tag.includes("fixed") && !tag.includes("px-4") && !tag.includes("max-w-"),
      `${stem} must span the full inset, uncapped and unpadded, or rows anchor to a shrunken box`,
    );
  }
});

test("every renderable row caps itself and parks on its alignment", () => {
  const marginFor = (stem: string): string =>
    stem.endsWith("left") ? "mr-auto" : stem.endsWith("right") ? "ml-auto" : "mx-auto";
  for (const stem of STEMS) {
    const html = read(stem);
    const at = html.indexOf("{...machine.getToastProps(row)}");
    if (at === -1) continue; // updatable includes the promise render
    const start = html.lastIndexOf("<div", at);
    const tag = html.slice(start, html.indexOf(">", at));
    assert.ok(
      tag.includes("max-w-[38rem]"),
      `${stem} must cap the row below the viewport, or narrow screens overflow`,
    );
    assert.ok(
      tag.includes(marginFor(stem)),
      `${stem} must park the row with ${marginFor(stem)}`,
    );
  }
});

test("the action specimen renders its action trigger", () => {
  const html = read("action");
  assert.ok(
    html.includes("getActionTriggerProps"),
    "action must spread the action trigger, or Restart fires nothing",
  );
});
