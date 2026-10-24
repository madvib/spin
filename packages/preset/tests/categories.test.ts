import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import {
  elementNamed,
  PRIMITIVE_CATEGORIES,
  PRIMITIVE_ELEMENTS,
} from "../src/rules/primitives/categories.ts";
import {
  primitiveCategories,
  primitiveContracts,
  primitiveElements,
} from "../src/rules/primitives/manifest.ts";
import { componentExamples } from "../src/rules/primitives/examples-index.ts";

/**
 * The taxonomy is a fact about the elements, so it is checked against the
 * elements: every component the library ships is filed in a group and wears a
 * glyph, and every glyph is a name the collection the apps load actually
 * carries.
 *
 * The glyph check is the one that matters: the icon preset generates a rule
 * for a name that is written down and for no name that is not, so a glyph
 * that does not exist renders NOTHING — an empty row that looks like a
 * styling accident and is really a typo.
 */

const LUCIDE = lucide.icons as Record<string, unknown>;

/** The collection name a glyph class spends. */
const LUCIDE_CLASS = "i-lucide-";

/** The name inside the class: `i-lucide-star` is `star`. */
function glyphName(icon: string): string {
  return icon.startsWith(LUCIDE_CLASS) ? icon.slice(LUCIDE_CLASS.length) : icon;
}

test("every component the library ships is filed in a group", () => {
  const groups = new Set(PRIMITIVE_CATEGORIES.map((category) => category.id));
  const missing: string[] = [];
  for (const id of Object.keys(componentExamples)) {
    const element = elementNamed(id);
    if (element === undefined) {
      missing.push(`${id} is filed nowhere`);
      continue;
    }
    if (!groups.has(element.category)) {
      missing.push(`${id} is filed in ${element.category}, which is no group`);
    }
  }
  deepStrictEqual(missing, [], missing.join(", "));
});

test("every group carries at least one element", () => {
  // A group with nothing in it is a heading over nothing: the rail would
  // draw a band the reader could not act on.
  const empty = PRIMITIVE_CATEGORIES
    .filter((category) =>
      !PRIMITIVE_ELEMENTS.some((element) => element.category === category.id)
    )
    .map((category) => category.label);
  deepStrictEqual(empty, [], `empty groups: ${empty.join(", ")}`);
});

test("every glyph is a name the lucide collection carries", () => {
  const unknown: string[] = [];
  for (const element of PRIMITIVE_ELEMENTS) {
    const name = glyphName(element.icon);
    if (!(name in LUCIDE)) unknown.push(`${element.name} wears ${name}`);
  }
  deepStrictEqual(
    unknown,
    [],
    `the lucide collection has no such glyph: ${unknown.join(", ")}`,
  );
});

test("the manifest carries the taxonomy the elements are filed by", () => {
  // The manifest is what every consumer reads, so a taxonomy that lives only
  // in the authoring module is a taxonomy the studio cannot see.
  deepStrictEqual(
    primitiveCategories.map((category) => category.id),
    PRIMITIVE_CATEGORIES.map((category) => category.id),
  );
  deepStrictEqual(
    primitiveElements.map((element) => element.name),
    PRIMITIVE_ELEMENTS.map((element) => element.name),
  );
  for (const element of primitiveElements) {
    const authored = elementNamed(element.name);
    assert(
      authored !== undefined,
      `${element.name} is in the manifest and in no taxonomy`,
    );
    deepStrictEqual(element.category, authored.category, element.name);
    deepStrictEqual(element.icon, authored.icon, element.name);
  }
});

test("a component's contract carries the group and the glyph it wears", () => {
  // The rail reads the taxonomy, but the contract is what a component IS —
  // and a component whose contract filed it elsewhere would be drawn in one
  // place and filed in another.
  const mismatched: string[] = [];
  for (const [name, contract] of Object.entries(primitiveContracts)) {
    const element = elementNamed(name);
    if (element === undefined) continue;
    if (contract.category !== element.category) {
      mismatched.push(`${name}: ${contract.category} vs ${element.category}`);
    }
    if (contract.icon !== element.icon) {
      mismatched.push(`${name}: ${contract.icon} vs ${element.icon}`);
    }
  }
  deepStrictEqual(mismatched, [], mismatched.join(", "));
});
