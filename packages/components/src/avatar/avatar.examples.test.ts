import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("./examples/", import.meta.url);
const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = [
  "badge",
  "badgeminimal",
  "basic",
  "count",
  "fallback",
  "group",
  "icon",
  "multiples",
  "pills",
  "pillsolid",
  "rounded",
  "status",
  "statusminimal",
  "trusted",
  "verification",
];

test("the gallery holds the fifteen specimens", () => {
  const stems = readdirSync(dir)
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.slice(0, -".html".length))
    .sort();
  assert.deepStrictEqual(stems, [...STEMS].sort());
});

test("every face binds its own machine under its own name", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    const faces = (html.match(/getRootProps\(\)/g) ?? []).length;
    const bindings = html.match(/const (\w+) = avatar\(/g) ?? [];
    assert.strictEqual(
      bindings.length,
      faces,
      `${stem} renders ${faces} faces but binds ${bindings.length}: one machine per face or every face repeats the first aria-label`,
    );
    const names = [...html.matchAll(/const (\w+) = avatar\(/g)].map((m) => m[1]);
    assert.strictEqual(new Set(names).size, names.length);
  }
});

test("every image mounts on src, not on loaded", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    const gates = [...html.matchAll(/show=\{(\w+)\.src !== "" && \1\.status !== "error"\}/g)];
    const faces = (html.match(/getRootProps\(\)/g) ?? []).length;
    assert.strictEqual(
      gates.length,
      faces,
      `${stem} must gate every image on its own src: loaded never arrives for a node that is not mounted`,
    );
    for (const line of html.split("\n")) {
      if (!line.includes("<img")) continue;
      assert.ok(
        !/\bshow=\{\w+\.loaded\}/.test(line),
        `${stem} must not gate the image on loaded alone`,
      );
    }
  }
});

test("no specimen borrows another face's markup", () => {
  for (const stem of STEMS) {
    assert.ok(
      !read(stem).includes("<include"),
      `${stem} must render its own faces: an include inherits hardcoded fallback text the script cannot rename`,
    );
  }
});
