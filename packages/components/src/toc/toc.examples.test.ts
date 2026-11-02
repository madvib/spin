import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();

test("every example binds the toc root, nav, title, and list", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getRootProps()"),
      `${stem} example must bind getRootProps`,
    );
    assert.ok(
      html.includes("getNavProps()"),
      `${stem} example must bind getNavProps`,
    );
    assert.ok(
      html.includes("getTitleProps()"),
      `${stem} example must bind getTitleProps`,
    );
    assert.ok(
      html.includes("getListProps()"),
      `${stem} example must bind getListProps`,
    );
  }
});

test("every example binds items and links per row", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getItemProps(row)"),
      `${stem} example must bind getItemProps(row)`,
    );
    assert.ok(
      html.includes("getLinkProps(row)"),
      `${stem} example must bind getLinkProps(row)`,
    );
  }
});
