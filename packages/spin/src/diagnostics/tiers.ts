/**
 * What a utility does to an element, read from the catalog's own grouping.
 *
 * The catalog already sorts every utility into a family — background, text
 * colour, border, padding, gap, type size, font, radius, shadow — and the
 * families say what a class DOES. This module reads that grouping and gives
 * each family a tier:
 *
 * - **layout** — where the element sits and how big it is. Display, flex and
 *   grid, gap, alignment, position, sizing, ordering, and the spacing that
 *   separates things. Free anywhere: a box that is laid out is not making a
 *   decision about how it looks.
 * - **skin** — how the element looks. Colour, background, border, radius,
 *   shadow, font family, font weight, text transform, letter spacing,
 *   opacity. This is the decision an element owns, and a utility that
 *   overwrites it is a conflict.
 * - **structure** — how big the element's text is. A type scale is a
 *   decision about the shape of the content, not about the box around it.
 * - **spacing** — the space between blocks, on an element the theme types.
 *   It is CONTEXTUAL: a margin or a padding is layout everywhere else, and
 *   the theme's rhythm wherever the theme types the element.
 *
 * The mapping is by catalog group, not by a hand-written list of class
 * names, so a rule added to the preset is tiered the moment the catalog
 * names it — and the test that reads this map against the catalog fails when
 * a family arrives without a tier.
 */

import { type Decision, isSpacing } from "./properties.ts";

/** What a utility does to an element. */
export type Tier = "layout" | "skin" | "structure" | "spacing";

/**
 * The tier of each catalog group.
 *
 * Every group the catalog produces is here. `variants` is the exception and
 * deliberately absent: it holds prefixes (`hover:`, `focus:`), not utilities,
 * so there is nothing to tier.
 */
export const TIER_BY_GROUP: Readonly<Record<string, Tier>> = {
  // Layout — where the element sits, how big it is, how things line up.
  layout: "layout",
  sizing: "layout",
  grid: "layout",
  display: "layout",
  text: "layout",
  position: "layout",
  overflow: "layout",
  padding: "layout",
  margin: "layout",
  gap: "layout",
  interactivity: "layout",
  transitions: "layout",

  // Skin — how the element looks. The decision an element owns.
  background: "skin",
  "text-color": "skin",
  border: "skin",
  divide: "skin",
  radius: "skin",
  shadow: "skin",
  opacity: "skin",
  "text-decoration": "skin",
  typography: "skin",

  // Structure — the size of the element's text. TYPE-b: named styles inherit
  // the raw sizes' tier — a style fights the element's scale the way a size
  // step did, so the strictness dial reads it the way it read the step.
  "font-style": "structure",
};

/**
 * The word the message uses for what a tier overwrites.
 *
 * "Fill" is the system's word for the painted appearance of an element — the
 * theme's surfaces, inks, borders and accents — so a skin utility overwrites
 * the fill. A type size overwrites the scale the element's text is set in,
 * and spacing overwrites the rhythm the theme keeps between blocks.
 */
export function decisionOf(tier: Tier): string {
  if (tier === "structure") return "size";
  if (tier === "spacing") return "spacing";
  if (tier === "layout") return "layout";
  return "fill";
}

/**
 * The decision each catalog group makes.
 *
 * The tier says whether a utility counts as painting over an element; the
 * DECISION says which. Both are skin, and only one of them is a second
 * opinion about an element's own look: a control that sets its own fill says
 * nothing about the scale its text is read in, and a text element that sets
 * its own scale says nothing about the fill around it.
 *
 * The names are the primitives' own — the decisions an element's look is made
 * of — so the lint and the manifest speak the same words.
 */
export const PAINT_BY_GROUP: Readonly<Record<string, Decision>> = {
  background: "background",
  "text-color": "ink",
  border: "edge",
  divide: "edge",
  radius: "corner",
  shadow: "elevation",
  opacity: "opacity",
  "text-decoration": "decoration",
  "font-style": "size",
};

/**
 * The decision a utility makes.
 *
 * The catalog's group says what the family does; one family holds more than
 * one decision, and the NAME says which: in `typography`, tracking is
 * tracking, a capitalisation is a case, and the focus ring is an edge.
 */
export function paintKeyFor(
  utility: string,
  group: string,
): Decision | undefined {
  const named = PAINT_BY_GROUP[group];
  if (named !== undefined) return named;
  if (group === "typography") {
    if (utility.startsWith("tracking-")) return "tracking";
    if (utility.startsWith("outline-")) return "edge";
    return "case";
  }
  return undefined;
}

/**
 * The tier of a utility, in the place it is used.
 *
 * Where a box sits is the author's, so the spacing is layout — free,
 * unless the theme types the element. On an element the theme types, the
 * space between blocks is the document's rhythm and the theme states it: a
 * margin or a padding there is a decision about the shape of the content,
 * like a type size, and not about where the box sits.
 *
 * So the tier is not a property of the class alone: it is a property of the
 * class AND the element it is on.
 */
export function tierInPlace(
  tier: Tier,
  properties: readonly string[],
  element: ReadonlyMap<string, string>,
): Tier {
  if (tier !== "layout") return tier;
  // The family has to correspond: a padding the theme states makes a padding
  // a decision, not a margin — the theme typing the element's inside says
  // nothing about its outside. `mb-2` on a `<button>` that claims padding
  // stays layout, the author's own.
  const elementPads = [...element.keys()].some((property) =>
    property.startsWith("padding")
  );
  const elementMargins = [...element.keys()].some((property) =>
    property.startsWith("margin")
  );
  const pads = properties.some((property) => property.startsWith("padding"));
  const margins = properties.some((property) =>
    property.startsWith("margin")
  );
  if ((pads && elementPads) || (margins && elementMargins)) return "spacing";
  return tier;
}
