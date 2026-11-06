import { test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (stem: string): string =>
  readFileSync(new URL(`./examples/${stem}.html`, import.meta.url), "utf8");

test("the example mounts the input with a minimal seed", () => {
  const html = read("basic");
  assert.ok(
    html.includes("dateInput({})"),
    "the example must seed nothing the component does not need",
  );
  assert.ok(
    html.includes("getRootProps()"),
    "the example must bind the root",
  );
  assert.ok(
    html.includes("getControlProps()"),
    "the example must bind the segment group",
  );
  assert.ok(
    html.includes("getHiddenInputProps()"),
    "the example must bind the form value",
  );
});

test("segments highlight one at a time and placeholders read muted", () => {
  const html = read("basic");
  assert.ok(
    html.includes("machine.activeSegment === row.fieldIndex"),
    "the highlight must key on the focused segment, not whole-input focus",
  );
  assert.ok(
    html.includes("text-muted"),
    "placeholders must read muted against filled segments",
  );
  assert.ok(
    !html.includes("machine.focused }]}"),
    "whole-input focus must not drive the segment highlight",
  );
});
