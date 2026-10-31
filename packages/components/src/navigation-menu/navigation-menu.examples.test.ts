import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = ["basic", "grouped", "minimal"];

test("every example binds the full menubar contract", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    for (
      const getter of [
        "getRootProps()",
        "getListProps()",
        "getItemProps(row)",
        "getLinkProps(row)",
        "getItemContentProps(row)",
      ]
    ) {
      assert.ok(
        html.includes(getter),
        `${stem} example must bind ${getter}`,
      );
    }
  }
});

test("every bar lays its items out horizontally", () => {
  for (const stem of STEMS) {
    assert.ok(
      read(stem).includes("row-list"),
      `${stem} example must run its triggers through row-list`,
    );
  }
});

test("every panel floats above the page", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("absolute") && html.includes("z-dropdown"),
      `${stem} example must float its panels on the dropdown layer`,
    );
  }
});

test("the trigger link is the only getLinkProps per row", () => {
  for (const stem of STEMS) {
    const uses = read(stem).match(/getLinkProps\(row\)/g) ?? [];
    deepStrictEqual(
      uses.length,
      1,
      `${stem} example must stamp one link id per row — panel links carry their own hrefs`,
    );
  }
});

test("every panel link carries its own destination", () => {
  assert.ok(
    read("basic").includes("href={row.ctaHref}"),
    "basic panel CTA must read its destination from the row",
  );
  const grouped = read("grouped");
  assert.ok(
    grouped.includes("href={row.primaryHref}") &&
      grouped.includes("href={row.secondaryHref}"),
    "grouped footer links must read their destinations from the row",
  );
});

test("no anchor leans on bare for its decoration", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    const anchors = [...html.matchAll(/<a[\s>][\s\S]*?(?=<a[\s>]|$)/g)];
    for (const anchor of anchors) {
      assert.ok(
        anchor[0].includes("no-underline"),
        `${stem} example anchors must strip the UA underline — bare is a button reset`,
      );
    }
    assert.ok(anchors.length > 0, `${stem} example must render anchors`);
  }
});
