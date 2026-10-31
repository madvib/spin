import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

test("dropdown specimens bind the trigger-positioner-content chain", () => {
  for (const stem of ["basic", "compact"]) {
    const html = read(stem);
    assert.ok(
      html.includes("getTriggerProps()"),
      `${stem} example must bind getTriggerProps for the button`,
    );
    assert.ok(
      html.includes("getPositionerProps()"),
      `${stem} example must bind getPositionerProps for the popup`,
    );
    assert.ok(
      html.includes("getContentProps()"),
      `${stem} example must bind getContentProps for the listbox`,
    );
  }
});

test("every example binds items with state read from the machine", () => {
  for (const stem of ["basic", "cards", "compact", "swatches"]) {
    const html = read(stem);
    assert.ok(
      html.includes("getItemProps(row)"),
      `${stem} example must bind getItemProps for each theme`,
    );
    assert.ok(
      html.includes("machine.getItemState(row).selected"),
      `${stem} example must read selection from getItemState`,
    );
  }
});

test("selected borders style each state in exactly one key", () => {
  for (const stem of ["cards", "swatches"]) {
    const html = read(stem);
    const at = html.indexOf("getItemProps");
    const tag = html.slice(html.lastIndexOf("<button", at), at);
    const statik = tag.slice(tag.indexOf('class={["') + 9, tag.indexOf('", {'));
    assert.ok(
      !statik.includes("border-border") && !statik.includes("border-primary"),
      `${stem} example must keep border color out of the static classes — a static border beats the conditional in the cascade`,
    );
    assert.ok(
      tag.includes("machine.getItemState(row).selected === false"),
      `${stem} example must style the unselected border in its own conditional key`,
    );
  }
});

test("examples never shadow the bag's own attributes", () => {
  for (const stem of ["basic", "cards", "compact", "swatches"]) {
    const html = read(stem);
    assert.ok(
      !html.includes("data-theme-option") &&
        !html.includes("data-swatch-theme=") &&
        !html.includes('role="option"'),
      `${stem} example must let the bag own role, data-value, and data-swatch-theme`,
    );
  }
});
