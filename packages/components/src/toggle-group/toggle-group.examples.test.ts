import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const AUTHORED = ["basic", "ghost", "icons", "outline", "toolbar"];

test("every authored example renders one button per item", () => {
  for (const stem of AUTHORED) {
    const html = read(stem);
    assert.ok(
      html.includes("getItems()") && html.includes("getItemProps(row)"),
      `${stem} must render one button per item`,
    );
  }
});

test("every authored example shows the pressed state live", () => {
  for (const stem of AUTHORED) {
    const html = read(stem);
    assert.ok(
      html.includes("getItemState(row).pressed"),
      `${stem} must key the on visual on the live pressed state, or on and off render identically`,
    );
    assert.ok(
      html.includes("!machine.getItemState(row).pressed"),
      `${stem} must key the off ink exclusively, or the static muted class fights the pressed fill`,
    );
    assert.ok(
      html.includes(": machine.getItemState(row).pressed"),
      `${stem} must condition the on visual on pressed being true (a bare mention inside the negated off-key does not count)`,
    );
  }
});

test("the multiple example reuses the single-select markup", () => {
  const html = read("multiple");
  assert.ok(
    html.includes('<include file="./basic.html"'),
    "multiple must include the basic markup so the pressed visual stays one definition",
  );
  assert.ok(
    html.includes("multiple: true"),
    "multiple must run the group in multiple mode",
  );
});

test("icon glyphs outside flex items take inline-block", () => {
  const bare = ["cl", "ass", "="].join("") + '"i-lucide-';
  for (const stem of ["icons", "toolbar"]) {
    const html = read(stem);
    assert.ok(
      !html.includes(bare),
      `${stem} must not leave a bare icon span in inline context: it collapses to 0x0`,
    );
    assert.ok(
      html.includes("inline-block i-lucide-"),
      `${stem} must blockify its icon spans so the glyph takes size`,
    );
  }
});
