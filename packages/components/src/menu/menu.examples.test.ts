import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();

test("every example renders its submenu level inline", () => {
  for (const stem of STEMS) {
    assert.ok(
      read(stem).includes("getSubmenuContentProps(row)"),
      `${stem} example must render the inline submenu level`,
    );
    assert.ok(
      read(stem).includes("show={machine.openSubmenu === row.value}"),
      `${stem} example must gate the level on its own row`,
    );
    assert.ok(
      read(stem).includes("getSubmenuItemProps(child)"),
      `${stem} example must bind the level's rows to submenu items`,
    );
    assert.ok(
      read(stem).includes("start-full"),
      `${stem} example must place the level beside its row, where the content scan reads it`,
    );
  }
});


test("no example mounts a nested menu element", () => {
  for (const stem of STEMS) {
    assert.ok(
      !read(stem).includes("<spin-menu"),
      `${stem} example must not nest a menu element: no such element is defined`,
    );
  }
});

test("every submenu chevron tracks its own level", () => {
  for (const stem of STEMS) {
    assert.ok(
      read(stem).includes('{ "rotate-90": machine.openSubmenu === row.value }'),
      `${stem} example must rotate the chevron only while its level is open`,
    );
  }
});

test("nested example carries a row with children", () => {
  assert.ok(
    read("nested").includes("children:"),
    "nested example must carry a row with children or the level never opens",
  );
});
