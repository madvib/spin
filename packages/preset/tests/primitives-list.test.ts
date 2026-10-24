import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { primitiveComponents } from "@spin/preset";
import { componentExamples } from "../src/rules/primitives/examples-index.ts";
import { listedComponents } from "../src/primitives-procedures.ts";

/**
 * The gallery list is a CONTRACT, not a projection of the manifest.
 *
 * The manifest also holds two entries that are not things anyone browses —
 * `a11y` is a utility family and `field` is the contract input/textarea
 * share — and it misses five components whose examples are authored beside
 * rules the manifest does not name at all. Deriving the list from either one
 * alone ships a gallery with dead ends and holes.
 */

const listed = listedComponents();

test("every browsable component ships examples", () => {
  for (const component of listed) {
    assert(
      component.examples !== undefined,
      `${component.name} is listed but has nothing to show`,
    );
    assert(
      component.examples.rows.length > 0,
      `${component.name} is listed but its example set is empty`,
    );
  }
});

test("every authored example set is reachable from the gallery", () => {
  deepStrictEqual(
    new Set(listed.map((component) => component.name)),
    new Set(Object.keys(componentExamples)),
  );
});

test("manifest data rides along where the manifest models the component", () => {
  const button = listed.find((component) => component.name === "button");
  const manifest = primitiveComponents.button;
  assert(button !== undefined);
  deepStrictEqual(button.tags, [...manifest.tags]);
  deepStrictEqual(button.variants, [...manifest.variants]);
  deepStrictEqual(button.reads, [...manifest.reads]);
});

test("a component the manifest does not model still lists with an empty vocabulary", () => {
  const input = listed.find((component) => component.name === "input");
  assert(input !== undefined, "input ships examples and must be browsable");
  deepStrictEqual(input.tags, []);
  deepStrictEqual(input.variants, []);
  deepStrictEqual(input.reads, []);
});

test("a component's wiring agrees with the attributes its examples use", () => {
  // A script that names an attribute no row sets is wiring left over from a
  // fixture that changed: it reads as supported and does nothing. A script
  // with no data attribute anywhere in its rows is the same defect with no
  // attribute to point at.
  const attributesOf = (rows: readonly { html: string }[]) =>
    new Set(
      rows.flatMap((row) => [...row.html.matchAll(/data-[a-z-]+/g)]).map(
        (match) => match[0],
      ),
    );

  for (const component of listed) {
    const script = component.examples?.onLoad;
    if (script === undefined) continue;
    const rows = component.examples?.rows ?? [];
    const used = attributesOf(rows);
    for (const match of script.matchAll(/data-[a-z-]+/g)) {
      assert(
        used.has(match[0]),
        `${component.name} wires ${match[0]}, which none of its rows set`,
      );
    }
    assert(used.size > 0, `${component.name} ships a script for no attribute`);
  }
});
