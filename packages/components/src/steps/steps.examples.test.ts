import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

const STEMS = readdirSync(new URL("./examples/", import.meta.url))
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.slice(0, -".html".length))
  .sort();

test("every example binds the stepper root and list", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    assert.ok(
      html.includes("getRootProps()"),
      `${stem} example must bind getRootProps for the stepper`,
    );
    assert.ok(
      html.includes("getListProps()"),
      `${stem} example must bind getListProps for the tablist`,
    );
  }
});

test("every example binds the item quartet", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    for (const part of [
      "getItemProps",
      "getTriggerProps",
      "getIndicatorProps",
      "getSeparatorProps",
    ]) {
      assert.ok(
        html.includes(part),
        `${stem} example must bind ${part} for each step`,
      );
    }
  }
});

test("horizontals lay out in a row, verticals in a flow", () => {
  for (const stem of ["vertical", "verticallabels", "verticalnavigation"]) {
    assert.ok(
      read(stem).includes("flow-list"),
      `${stem} example must stack its steps vertically`,
    );
  }
  for (const stem of STEMS.filter(
    (s) => s !== "vertical" && s !== "verticallabels" && s !== "verticalnavigation",
  )) {
    assert.ok(
      read(stem).includes("row-list"),
      `${stem} example must lay its steps out in a row`,
    );
  }
});

test("content panels let the bag own visibility", () => {
  for (const stem of ["content", "vertical"]) {
    const html = read(stem);
    const at = html.indexOf("getContentProps");
    assert.ok(at !== -1, `${stem} example must bind getContentProps`);
    const tag = html.slice(html.lastIndexOf("<div", at), at);
    assert.ok(
      !tag.includes("hidden") && !tag.includes("display:none"),
      `${stem} example must not statically hide its content panel — the bag hides only the non-current ones`,
    );
  }
});

test("progress specimens bind the progress pair", () => {
  for (const stem of ["progress", "vertical"]) {
    const html = read(stem);
    assert.ok(
      html.includes("getProgressProps()"),
      `${stem} example must bind getProgressProps for the bar`,
    );
    assert.ok(
      html.includes("getProgressFillProps()"),
      `${stem} example must bind getProgressFillProps for the fill`,
    );
  }
});

test("driven specimens bind both step buttons", () => {
  for (const stem of [
    "basic",
    "content",
    "navigation",
    "progress",
    "segmented",
    "vertical",
    "verticalnavigation",
  ]) {
    const html = read(stem);
    assert.ok(
      html.includes("getPrevTriggerProps()"),
      `${stem} example must bind getPrevTriggerProps`,
    );
    assert.ok(
      html.includes("getNextTriggerProps()"),
      `${stem} example must bind getNextTriggerProps`,
    );
  }
});

test("indicators style each state in exactly one key", () => {
  for (const stem of STEMS) {
    const html = read(stem);
    const at = html.indexOf("getIndicatorProps");
    assert.ok(at !== -1, `${stem} example must bind getIndicatorProps`);
    const tag = html.slice(html.lastIndexOf("<span", at), at);
    const statik = tag.slice(tag.indexOf('class={["') + 9, tag.indexOf('", {'));
    assert.ok(
      !statik.includes("bg-") &&
        !statik.includes("text-text") &&
        !statik.includes("border-border") &&
        !statik.includes("border-primary"),
      `${stem} example must keep state color out of the indicator's static classes — a static bg beats the conditional in the cascade`,
    );
    assert.ok(
      tag.includes("machine.getItemState(row).incomplete"),
      `${stem} example must style the incomplete state in its own conditional key`,
    );
  }
});
