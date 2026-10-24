import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { describeCatalog } from "@spin/preset";
import { parseTokens } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import { TIER_BY_GROUP, tierInPlace } from "../src/tiers.ts";

/**
 * The tiers are the catalog's own grouping, read.
 *
 * A family that arrives without a tier would be a family the semantic rule
 * cannot judge — and a class it cannot judge is a class it cannot report.
 * The catalog is the source of truth for what families exist, so the test
 * reads the catalog rather than a list of its own.
 */
test("every catalog family has a tier", () => {
  const parsed = parseTokens(starterThemes.silk);
  if (!parsed.ok) throw new Error("the shipped theme does not parse");
  const families = describeCatalog(parsed.tree).map((section) => section.id);
  for (const family of families) {
    // The variants family holds prefixes rather than utilities, so there
    // is nothing in it to tier.
    if (family === "variants") continue;
    deepStrictEqual(
      TIER_BY_GROUP[family] !== undefined,
      true,
      `the catalog family \`${family}\` has no tier`,
    );
  }
});

test("the tier of a family says what it does to an element", () => {
  // A spot check on the reading: the families that paint are skin, the one
  // that sets the type scale is structure, and the ones that place things
  // are layout.
  deepStrictEqual(TIER_BY_GROUP["background"], "skin");
  deepStrictEqual(TIER_BY_GROUP["text-color"], "skin");
  deepStrictEqual(TIER_BY_GROUP["border"], "skin");
  deepStrictEqual(TIER_BY_GROUP["radius"], "skin");
  deepStrictEqual(TIER_BY_GROUP["shadow"], "skin");
  deepStrictEqual(TIER_BY_GROUP["font"], "skin");
  deepStrictEqual(TIER_BY_GROUP["opacity"], "skin");
  deepStrictEqual(TIER_BY_GROUP["typography"], "skin");
  deepStrictEqual(TIER_BY_GROUP["type-size"], "structure");
  deepStrictEqual(TIER_BY_GROUP["layout"], "layout");
  deepStrictEqual(TIER_BY_GROUP["sizing"], "layout");
  deepStrictEqual(TIER_BY_GROUP["grid"], "layout");
  deepStrictEqual(TIER_BY_GROUP["display"], "layout");
  deepStrictEqual(TIER_BY_GROUP["position"], "layout");
  deepStrictEqual(TIER_BY_GROUP["gap"], "layout");
  deepStrictEqual(TIER_BY_GROUP["padding"], "layout");
  deepStrictEqual(TIER_BY_GROUP["margin"], "layout");
});

test("the spacing is layout until the theme types the element", () => {
  // Where a box sits is the author's — so a margin is free on an element
  // the theme says nothing about.
  const untyped = new Map<string, string>();
  deepStrictEqual(tierInPlace("layout", ["margin-top"], untyped), "layout");
});

test("the spacing on a typed element is the theme's", () => {
  // The theme states the space under a paragraph, so a margin there is a
  // decision about the document's rhythm — and it is compared with the
  // theme's, like a type size.
  const typed = new Map<string, string>([
    ["margin-bottom", "var(--spacing-2)"],
  ]);
  deepStrictEqual(tierInPlace("layout", ["margin-bottom"], typed), "spacing");
  deepStrictEqual(tierInPlace("layout", ["padding-left"], typed), "spacing");
});

test("a tier that is not layout does not change where it is used", () => {
  // The size of an element's text is the theme's wherever the element
  // stands, and the fill with it.
  const untyped = new Map<string, string>();
  deepStrictEqual(tierInPlace("structure", ["font-size"], untyped), "structure");
  deepStrictEqual(tierInPlace("skin", ["color"], untyped), "skin");
});
