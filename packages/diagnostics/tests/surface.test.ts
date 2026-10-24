import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { spinPreset } from "@spinjs/preset";
import { starterThemes } from "@spinjs/theme/themes";
import { factsFor } from "../src/facts.ts";
import { canonicalMap } from "../src/properties.ts";

/**
 * The surfaces are what the theme puts on an element — read by running the
 * preset's rules.
 *
 * The lint compares a class with an element by the values they set, so a
 * wrong reading would be a wrong finding. The stylesheet the theme ships is
 * the answer the lint has to agree with: the rules the lint runs are the
 * rules the stylesheet comes from, and this holds the two to each other.
 */

const facts = factsFor(Object.values(starterThemes));

/**
 * The declarations a stylesheet carries for a tag.
 *
 * The first declaration of a property wins: the resting rule comes before
 * the rules that reach for a state, and the resting rule is what the
 * element carries.
 */
function declarationsOf(css: string, tag: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (block[1] as string).trim();
    if (!selector.includes(tag)) continue;
    const properties: [string, string][] = [];
    for (const declaration of (block[2] as string).split(";")) {
      const cut = declaration.indexOf(":");
      if (cut === -1) continue;
      const property = declaration.slice(0, cut).trim();
      const value = declaration.slice(cut + 1).trim();
      if (property === "") continue;
      properties.push([property, value]);
    }
    for (const [property, value] of canonicalMap(properties)) {
      if (!out.has(property)) out.set(property, value);
    }
  }
  return out;
}

test("the surfaces agree with the stylesheet the theme ships", async () => {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: starterThemes })],
  });
  for (const tag of ["h1", "h3", "h6", "p", "li", "code", "button", "kbd"]) {
    const { css } = await uno.generate(tag, { preflights: false });
    const shipped = declarationsOf(css, tag);
    const surface = facts.surfaces.element(tag, []);
    for (const [property, value] of surface) {
      deepStrictEqual(
        shipped.get(property),
        value,
        `the theme puts ${property} on <${tag}>`,
      );
    }
  }
});

test("a class declares what the stylesheet declares for it", async () => {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: starterThemes })],
  });
  for (const cls of ["text-xl", "bg-primary", "p-4", "rounded-md"]) {
    const { css } = await uno.generate(cls, { preflights: false });
    const shipped = declarationsOf(css, `.${cls}`);
    const utility = facts.surfaces.utility(cls);
    for (const [property, value] of utility) {
      deepStrictEqual(
        shipped.get(property),
        value,
        `the stylesheet declares ${property} for \`${cls}\``,
      );
    }
  }
});

test("an element the theme does not type has no surface", () => {
  // A div is the author's box: the theme says nothing about how it looks,
  // so there is nothing for a class to be measured against.
  deepStrictEqual([...facts.surfaces.element("div", [])], []);
});

test("a class the theme cannot produce declares nothing", () => {
  deepStrictEqual([...facts.surfaces.utility("not-a-class")], []);
});
