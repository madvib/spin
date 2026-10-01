import { assert, assertEquals } from "@std/assert";
import { createGenerator } from "@unocss/core";
import { describeCatalog, scaffoldDocument, spinPreset } from "../src/index.ts";
import { parseTokens } from "@spin/theme";

/**
 * The catalog describes what a theme can produce, so the generator is its
 * oracle: every utility the catalog names must actually emit CSS from a
 * generator built with that same theme.
 *
 * There is no list here on purpose. A test that enumerated the sections would
 * fail every time one is added, which is the normal case, and would prove
 * nothing a round-trip does not. This one breaks only if the catalog starts
 * naming something that does not work — which is the defect a user of the
 * utility reference would actually hit.
 */

/** UnoCSS escapes `/` and `:` in class selectors; the catalog names them plain. */
function selectorFor(utility: string): string {
  return `.${utility.replace(/([:/])/g, "\\$1")}`;
}

const THEME = {
  ...(scaffoldDocument() as Record<string, unknown>),
  spacing: { $type: "dimension", 4: { $value: "1rem" } },
  radius: { $type: "dimension", lg: { $value: "0.5rem" } },
  shadow: { $type: "shadow", md: { $value: "0 1px 2px black" } },
  breakpoint: { $type: "dimension", md: { $value: "48rem" } },
  color: {
    $type: "color",
    text: { $value: "#111111" },
    "text-muted": { $value: "#555555" },
    surface: { $value: "#ffffff" },
    "surface-raised": { $value: "#f0f0f0" },
    border: { $value: "#999999" },
    primary: { $value: "#333333" },
    secondary: { $value: "#444444" },
    accent: { $value: "#555555" },
    semantic: {
      success: { $value: "#1a7f37" },
      warning: { $value: "#9a6700" },
      error: { $value: "#b42318" },
      info: { $value: "#175cd3" },
    },
    "on-primary": { $value: "#ffffff" },
    "on-danger": { $value: "#ffffff" },
    "focus-ring": { $value: "#333333" },
    link: { $value: "#175cd3" },
  },
} as Record<string, unknown>;

async function generated(utilities: string[]): Promise<string> {
  const uno = await createGenerator({
    presets: [spinPreset({ themes: { light: THEME } })],
  });
  const { css } = await uno.generate(utilities.join(" "));
  return css;
}

Deno.test("every utility the catalog names actually generates", async () => {
  const parsed = parseTokens(THEME);
  if (!parsed.ok) throw new Error(parsed.error);
  const claimed = describeCatalog(parsed.tree).flatMap((s) => s.utilities);
  assert(claimed.length > 0, "the catalog claims nothing");

  const css = await generated(claimed);
  const missing = claimed.filter((utility) =>
    !css.includes(selectorFor(utility))
  );
  assertEquals(
    missing,
    [],
    "the utility reference names these, but the generator emits nothing",
  );
});

Deno.test("a theme with no scales is described honestly", () => {
  // The scaffold declares roles and no scales. The families that need a scale
  // have nothing to describe, so the catalog must not claim them — a reference
  // listing `p-4` for a theme with no spacing scale would be telling a user to
  // write a class that does nothing.
  const parsed = parseTokens(scaffoldDocument());
  if (!parsed.ok) throw new Error(parsed.error);
  const padding = describeCatalog(parsed.tree).find((s) => s.id === "padding");
  assertEquals(padding?.utilities, [], "no spacing scale, nothing to claim");

  const background = describeCatalog(parsed.tree).find((s) =>
    s.id === "background"
  );
  assert(
    (background?.utilities.length ?? 0) > 0,
    "colors resolve from roles alone, so colour families stay listed",
  );
});

Deno.test("the catalog reflects the theme, not a fixed inventory", () => {
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
  assertEquals(
    added.sort(),
    ["bg-accentish", "border-accentish", "divide-accentish", "text-accentish"],
    "one added colour step is named in the colour families",
  );
  assert(
    count(withTwo) > count(withOne),
    "and the inventory grows with the theme",
  );
});
