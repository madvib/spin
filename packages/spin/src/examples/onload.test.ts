import { test } from "bun:test";
import assert from "node:assert/strict";
import { parseHTML } from "@spinjs/runtime/testing";
import { def as comboboxDef } from "@spinjs/components/combobox";
import { EXAMPLE_ONLOAD } from "./onload.ts";
type RubricPart = { id?: string } & Record<string, unknown>;
const segmentsOf = (def: {
  parts: Record<string, RubricPart>;
  slots: Record<string, RubricPart>;
}): Set<string> => {
  const segments = new Set<string>();
  for (const [key, part] of Object.entries(def.parts)) {
    segments.add(part.id ?? key);
  }
  for (const [key, slot] of Object.entries(def.slots)) {
    segments.add(slot.id ?? key);
  }
  return segments;
};

test("the with-combobox glue names combobox parts the def emits", () => {
  const glue = EXAMPLE_ONLOAD["tags-input/with-combobox"];
  assert.ok(glue, "the pick glue must exist: it carries selection into tags");
  const segments = segmentsOf(comboboxDef);
  for (const match of glue.matchAll(/\[data-part=([^\]]+)\]/g)) {
    const segment = match[1]!;
    assert.ok(
      segments.has(segment),
      `the glue queries [data-part=${segment}] but the combobox emits no such part — the query matches nothing and the pick silently breaks`,
    );
  }
  assert.ok(
    glue.includes("[data-part=clearTrigger]"),
    "the glue must reset the field through the clear trigger, or the picked label sticks and the next pick filters on it",
  );
});

test("the types glue fires every button, not just the first", () => {
  const glue = EXAMPLE_ONLOAD["toast/types"];
  assert.ok(glue, "the fire glue must exist: the buttons cannot mint ids");
  const { document } = parseHTML(
    `<toast-types><button data-fire data-title="A" data-type="success"></button><button data-fire data-title="B" data-type="error"></button></toast-types>`,
  );
  const created: string[] = [];
  const host = document.querySelector("toast-types") as unknown as Record<string, unknown>;
  host["create"] = (item: { title: string }): void => void created.push(item.title);
  new Function("document", glue)(document);
  const buttons = [...document.querySelectorAll("[data-fire]")] as unknown as {
    click(): void;
  }[];
  for (const button of buttons) button.click();
  assert.deepStrictEqual(created, ["A", "B"]);
});
