import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();

test("every example binds the tabs root and list", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getRootProps()"),
      `${stem} example must bind getRootProps for the tabs`,
    );
    assert.ok(
      html.includes("getListProps()"),
      `${stem} example must bind getListProps for the tablist`,
    );
  }
});

test("every example binds triggers and panels per row", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getTriggerProps(row)"),
      `${stem} example must bind getTriggerProps for each row`,
    );
    assert.ok(
      html.includes("getContentProps(row)"),
      `${stem} example must bind getContentProps for each row`,
    );
  }
});

test("triggers style each state from aria-selected, not machine.value", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      !html.includes("machine.value"),
      `${stem} example must not read machine.value for paint`,
    );
    const at = html.indexOf("getTriggerProps");
    assert.ok(at !== -1, `${stem} example must bind getTriggerProps`);
    const tag = html.slice(html.lastIndexOf("<button", at), at);
    assert.ok(
      tag.includes("aria-[selected=true]"),
      `${stem} example must style the selected state via aria-[selected=true]`,
    );
    assert.ok(
      tag.includes("aria-[selected=false]"),
      `${stem} example must style the unselected state via aria-[selected=false]`,
    );
    assert.ok(
      !tag.includes("class={["),
      `${stem} example must collapse the trigger class to a static string`,
    );
  }
});

test("verticals declare their orientation", () => {
  for (const stem of [
    "vertical",
    "vertical-ghost",
    "vertical-icons",
    "vertical-underline",
    "vertical-with-icons",
  ]) {
    assert.ok(
      read(stem).includes('orientation: "vertical"'),
      `${stem} example must pass orientation vertical so the tablist announces it`,
    );
  }
});

test("icon specimens gate each icon to its row", () => {
  for (const stem of [
    "icon-above",
    "icon-only",
    "outline-with-icons",
    "stack-with-icons",
    "vertical-icons",
    "vertical-with-icons",
    "with-icons",
  ]) {
    const html = read(stem);
    assert.ok(
      html.includes("i-lucide-") && html.includes("show={row.value ==="),
      `${stem} example must render a per-row icon gated on the row value`,
    );
  }
});
