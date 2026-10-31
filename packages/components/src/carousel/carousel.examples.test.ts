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


test("every track promises the drag its cursor shows", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    if (!html.includes("cursor-grab")) continue;
    assert.ok(
      html.includes("allowMouseDrag: true"),
      `${stem} shows a grab cursor, so it must enable the drag action that honors it`,
    );
  }
});

test("every calc width spaces its operators", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    for (const match of html.matchAll(/calc\(([^)]*)\)/g)) {
      const expr = match[1] ?? "";
      assert.ok(
        !/[0-9%a-z)][-+][0-9%a-z(]/i.test(expr.replace(/_/g, " ")),
        `${stem} carries a calc the browser drops: ${expr}`,
      );
    }
  }
});

test("the cards specimen pages two slides at a time", () => {
  const html = read("cards");
  assert.ok(
    html.includes("slidesPerPage: 2"),
    "cards must ask for two slides per page",
  );
  assert.ok(
    html.includes("w-[calc((100%_-_0.5rem)/2)]"),
    "cards must size each slide to half the track minus the gap",
  );
});

test("every dot keys its width on the visible page and carries no padding", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    if (!html.includes("getIndicatorProps(row)")) continue;
    if (stem === "thumbnails") continue;
    assert.ok(
      html.includes("rounded-full p-0"),
      `${stem} must zero the button padding or the 8px dot renders 34px wide`,
    );
    assert.ok(
      /"(w-4|h-4 w-2)[^"]*": machine\.isInView\(row\.index\)/.test(html),
      `${stem} must light the dots of the visible slides, not the slide whose index equals the page`,
    );
  }
});
