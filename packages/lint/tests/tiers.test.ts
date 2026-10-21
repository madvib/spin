import { assertEquals } from "@std/assert";
import { describeCatalog } from "@spin/preset";
import { parseTokens } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import { TIER_BY_GROUP } from "../src/tiers.ts";

/**
 * The tiers are the catalog's own grouping, read.
 *
 * A family that arrives without a tier would be a family the semantic rule
 * cannot judge — and a class it cannot judge is a class it cannot report.
 * The catalog is the source of truth for what families exist, so the test
 * reads the catalog rather than a list of its own.
 */
Deno.test("every catalog family has a tier", () => {
  const parsed = parseTokens(starterThemes.silk);
  if (!parsed.ok) throw new Error("the shipped theme does not parse");
  const families = describeCatalog(parsed.tree).map((section) => section.id);
  for (const family of families) {
    // The variants family holds prefixes rather than utilities, so there
    // is nothing in it to tier.
    if (family === "variants") continue;
    assertEquals(
      TIER_BY_GROUP[family] !== undefined,
      true,
      `the catalog family \`${family}\` has no tier`,
    );
  }
});

Deno.test("the tier of a family says what it does to an element", () => {
  // A spot check on the reading: the families that paint are skin, the one
  // that sets the type scale is structure, and the ones that place things
  // are layout.
  assertEquals(TIER_BY_GROUP["background"], "skin");
  assertEquals(TIER_BY_GROUP["text-color"], "skin");
  assertEquals(TIER_BY_GROUP["border"], "skin");
  assertEquals(TIER_BY_GROUP["radius"], "skin");
  assertEquals(TIER_BY_GROUP["shadow"], "skin");
  assertEquals(TIER_BY_GROUP["font"], "skin");
  assertEquals(TIER_BY_GROUP["opacity"], "skin");
  assertEquals(TIER_BY_GROUP["typography"], "skin");
  assertEquals(TIER_BY_GROUP["type-size"], "structure");
  assertEquals(TIER_BY_GROUP["layout"], "layout");
  assertEquals(TIER_BY_GROUP["sizing"], "layout");
  assertEquals(TIER_BY_GROUP["grid"], "layout");
  assertEquals(TIER_BY_GROUP["display"], "layout");
  assertEquals(TIER_BY_GROUP["position"], "layout");
  assertEquals(TIER_BY_GROUP["gap"], "layout");
  assertEquals(TIER_BY_GROUP["padding"], "layout");
  assertEquals(TIER_BY_GROUP["margin"], "layout");
});
