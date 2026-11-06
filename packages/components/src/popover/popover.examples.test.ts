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


test("every specimen grounds its panel under the trigger", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    const at = html.indexOf("{...ctl.getContentProps()}");
    assert.ok(at !== -1, `${stem} must spread the content bag`);
    const tag = html.slice(at, html.indexOf(">", at));
    assert.ok(
      tag.includes("position-area-bottom-span-right"),
      `${stem} must place the panel under the trigger, left-aligned`,
    );
    assert.ok(
      tag.includes("m-0"),
      `${stem} must zero the UA auto margin or the panel centers`,
    );
  }
});

test("every specimen draws the panel surface from utilities", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    const at = html.indexOf("{...ctl.getContentProps()}");
    const tag = html.slice(at, html.indexOf(">", at));
    for (const cls of ["rounded-lg", "border", "bg-surface-raised", "shadow-lg"]) {
      assert.ok(
        tag.includes(cls),
        `${stem} must carry the ${cls} surface utility`,
      );
    }
  }
});

test("every trigger names itself accessibly", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    const at = html.indexOf("{...ctl.getTriggerProps()}");
    assert.ok(at !== -1, `${stem} must spread the trigger bag`);
    const open = html.slice(Math.max(0, at - 200), at);
    const after = html.slice(at, at + 400);
    const close = after.indexOf(">");
    const tag = open + after.slice(0, close);
    const body = after.slice(close + 1, close + 120);
    const named = tag.includes("aria-label")
      || tag.includes("aria-labelledby")
      || />([^<>]*[A-Za-z][^<>]*)</.test(after.slice(0, close + 120))
      || /sr-only">[^<]+</.test(body);
    assert.ok(named, `${stem} must name its trigger`);
  }
});
