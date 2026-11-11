import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();

test("every example binds the nav root", () => {
  for (const stem of STEMS) {
    assert.ok(
      read(stem).includes("getRootProps()"),
      `${stem} example must bind getRootProps for the navigation landmark`,
    );
  }
});

test("every numbered bar binds the item pair", () => {
  for (const stem of ["basic", "info", "jump", "numbered", "pagesize"]) {
    const html = read(stem);
    assert.ok(
      html.includes("getItemProps(row)") && html.includes("getEllipsisProps(row)"),
      `${stem} example must bind the item/ellipsis pair per row`,
    );
  }
});
test("dropdown jumps through a select, not size buttons", () => {
  const html = read("dropdown");
  assert.ok(
    html.includes("<select") && html.includes("machine.pageOptions"),
    "dropdown example must list every page in a select",
  );
  assert.ok(
    html.includes("on:change={(event) => machine.setPage(event.target.value)}"),
    "dropdown example must hand the picked value to setPage",
  );
  assert.ok(
    !html.includes("data-size"),
    "dropdown example must not carry the dead size hooks",
  );
});

test("pagesize calls the command it demonstrates", () => {
  const html = read("pagesize");
  for (const size of ["10", "20", "50"]) {
    assert.ok(
      html.includes(`machine.setPageSize(${size})`),
      `pagesize example must call setPageSize(${size}) from its own button`,
    );
  }
  assert.ok(
    !html.includes("data-size"),
    "pagesize example must not need glue hooks once it calls the command",
  );
});

test("pagesize shows a one-based range", () => {
  assert.ok(
    read("pagesize").includes("{machine.pageRange.start + 1}"),
    "pagesize example must show humans a one-based first row, not the slice index",
  );
});

test("jump keeps its glue-owned hooks", () => {
  const html = read("jump");
  assert.ok(
    html.includes('data-jump=""') && html.includes('data-go=""'),
    "jump example reads a live input value, which only the mount glue can do",
  );
  assert.ok(
    html.includes('aria-label="Go to page"'),
    "jump example must label its input",
  );
});
