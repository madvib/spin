import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();

test("every example binds the dial quartet", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    for (const part of [
      "getRootProps()",
      "getControlProps()",
      "getThumbProps",
      "getHiddenInputProps()",
    ]) {
      assert.ok(
        html.includes(part),
        `${stem} example must bind ${part} for the dial`,
      );
    }
  }
});

test("every thumb carries an accessible name", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("ariaLabel:") || html.includes("getLabelProps()"),
      `${stem} example must name its slider via the ariaLabel arg or the label part`,
    );
  }
  assert.ok(
    read("labeled").includes("getLabelProps()"),
    "labeled example must bind the label part it is named for",
  );
});

test("marked dials read marker state from the machine", () => {
  for (const stem of ["basic", "labeled", "marks"]) {
    const html = read(stem);
    assert.ok(
      html.includes("getMarkerProps({ value: row"),
      `${stem} example must bind getMarkerProps per marker`,
    );
    assert.ok(
      html.includes("machine.getMarkerState(row)"),
      `${stem} example must read marker state from getMarkerState`,
    );
  }
});

test("markers style each state in exactly one key", () => {
  for (const stem of ["basic", "labeled", "marks"]) {
    const html = read(stem);
    const at = html.indexOf("getMarkerState");
    const tag = html.slice(html.lastIndexOf("<span", at), at);
    const statik = tag.slice(tag.indexOf('class={["') + 9, tag.indexOf('", {'));
    assert.ok(
      !statik.includes("bg-border-strong") &&
        !statik.includes("bg-primary") &&
        !statik.includes("bg-semantic-success"),
      `${stem} example must keep marker color out of the static classes — a static bg beats the conditional in the cascade`,
    );
  }
});

test("examples never restate what the bags own", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      !html.includes("getValueTextProps(machine") &&
        !html.includes("touch-none") &&
        !html.includes("select-none") &&
        !html.includes("ml-0"),
      `${stem} example must not restate the control's touch behavior, pass the ignored valueText arg, or carry no-op margins`,
    );
  }
});
