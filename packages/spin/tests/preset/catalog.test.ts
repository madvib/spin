import { readFile } from "node:fs/promises";
import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { createGenerator } from "@unocss/core";
import { describeCatalog, scaffoldDocument, spinPreset } from "../../src/preset/index.ts";
import { parseTokens } from "../../src/theme/index.ts";
import { claims } from "../../src/preset/utils/claimed.ts";

/**
 * The REAL default theme, not a fixture.
 *
 * The catalog is built from a theme, so testing it against a hand-written one
 * measures the fixture: every colour the catalog names has to exist in
 * whatever it is compared against, and a partial theme turns "the reference
 * names a utility that does not work" into a false alarm.
 */
const THEME = JSON.parse(
  await readFile(
    new URL("../../src/theme/themes/silk.json", import.meta.url),
  ),
) as Record<string, unknown>;

test("every utility the catalog names actually generates", async () => {
  const parsed = parseTokens(THEME);
  if (!parsed.ok) throw new Error(parsed.error);
  // The variants section names prefixes (`hover:`), not utilities: a prefix on
  // its own matches no rule, so the generator oracle does not apply to it.
  const claimed = describeCatalog(parsed.tree)
    .filter((section) => section.id !== "variants")
    .flatMap((s) => s.utilities);
  assert(claimed.length > 0, "the catalog claims nothing");

  // ONE PER CALL. uno emits a bounded number of rules from a single
  // generate and drops the remainder without saying so: 806 distinct `p-N`
  // names come back as 41 rules. A batched assertion therefore does not test
  // the catalog, it tests the truncation, and reports the survivors as
  // failures — which is worse than no test, because it sends you looking for a
  // broken utility that is fine.
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { default: THEME } })],
  });
  const missing: string[] = [];
  for (const utility of claimed) {
    const { css } = await uno.generate(utility);
    if (!claims(css, utility)) missing.push(utility);
  }
  deepStrictEqual(
    missing,
    [],
    "the utility reference names these, but the generator emits nothing",
  );
});

test("a theme with no scales is described honestly", () => {
  // The scaffold declares roles and no scales. The families that need a scale
  // have nothing to describe, so the catalog must not claim them — a reference
  // listing `p-4` for a theme with no spacing scale would be telling a user to
  // write a class that does nothing.
  const parsed = parseTokens(scaffoldDocument());
  if (!parsed.ok) throw new Error(parsed.error);
  const padding = describeCatalog(parsed.tree).find((s) => s.id === "padding");
  deepStrictEqual(padding?.utilities, [], "no spacing scale, nothing to claim");

  const background = describeCatalog(parsed.tree).find((s) =>
    s.id === "background"
  );
  assert(
    (background?.utilities.length ?? 0) > 0,
    "colors resolve from roles alone, so colour families stay listed",
  );
});

test("the catalog reflects the theme, not a fixed inventory", () => {
  // Adding a colour step to the theme must add utilities to the catalog. This
  // is the direction a section list cannot check: it would notice a new
  // *section* but never a new *member*.
  const withOne = parseTokens({
    color: {
      $type: "color",
      primary: { $value: "#333333" },
      brand: { $value: "#ff0000" },
    },
  });
  if (!withOne.ok) throw new Error(withOne.error);
  const withTwo = parseTokens({
    color: {
      $type: "color",
      primary: { $value: "#333333" },
      brand: { $value: "#ff0000" },
      accentish: { $value: "#00ff00" },
    },
  });
  if (!withTwo.ok) throw new Error(withTwo.error);

  const count = (tree: typeof withOne) =>
    describeCatalog(tree.tree).flatMap((s) => s.utilities).length;
  // Four, not six: `border-accentish` and `divide-accentish` are named by the
  // catalog but emit nothing without a border-width token to pair with, which
  // is the honest answer for a theme with no widths. The point of the
  // assertion is that the inventory *moves with the theme*, not the exact
  // multiplier — so it names what it saw rather than a number it guessed.
  const added = describeCatalog(withTwo.tree)
    .flatMap((s) => s.utilities)
    .filter((u) =>
      !describeCatalog(withOne.tree).flatMap((s) => s.utilities).includes(u)
    );
  deepStrictEqual(
    added.sort(),
    ["bg-accentish", "border-accentish", "divide-accentish", "text-accentish"],
    "one added colour step is named in the colour families",
  );
  assert(
    count(withTwo) > count(withOne),
    "and the inventory grows with the theme",
  );
});
