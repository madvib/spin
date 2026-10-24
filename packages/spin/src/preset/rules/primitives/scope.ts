/**
 * What a primitive paints, and where.
 *
 * A primitive used to claim a set of TAGS and the claim was read off the
 * rules: a rule that mentioned `div` in one selector made `div` a globally
 * claimed tag, and every `div` in every project became an element the
 * primitives owned. The claim was an artifact of selector text, and it turned
 * into a law about what authors may write — a paragraph anywhere was "painted"
 * because a document surface mentioned `p` somewhere.
 *
 * The claim is now DECLARED, next to the rule that paints, and it says two
 * things: WHICH elements the primitive paints, and WHERE each of them has to
 * sit for the primitive to paint it.
 *
 * - **global** — the element is painted wherever it is. A heading is a
 *   heading everywhere, so the type a heading reads in is the type it reads
 *   in outside a document column too. Spin owns the typography of the whole
 *   application, and a global claim is how that is said.
 * - **descendant** — the element is painted only INSIDE the primitive's own
 *   element. A document surface paints the furniture of its column — the
 *   quotation's inset, the media's box, the code block's chrome — and not
 *   the furniture of the whole application.
 *
 * The declaration is what the rules are checked against: a rule that reaches
 * outside what its primitive declared is a failure, not a widening.
 */

import { claim, type Mode } from "./shared.ts";

/**
 * Where a primitive's painting lands.
 *
 * The two words are the whole of it: the element is painted wherever it is,
 * or it is painted inside the primitive's own element.
 */
export type Placement = "global" | "descendant";

/**
 * One painted element.
 *
 * The claim says WHICH element and WHERE; the ownership says what the
 * primitive decides for it — the decisions it makes about how it looks. The
 * ownership is DERIVED from the rules (the codegen reads what each rule
 * sets), so a manifest cannot claim a decision the rules do not make.
 */
export interface Paint {
  /** The tag the painted element has. */
  readonly tag: string;
  /** Where the painted element has to sit for the primitive to paint it. */
  readonly where: Placement;
}

/**
 * A painted element, with what the primitive decides for it.
 */
export interface OwnedPaint extends Paint {
  /** The decisions the primitive owns for it. */
  readonly owns: readonly string[];
}

/**
 * What a primitive paints.
 *
 * `self` is the element the primitive IS: the tag (or class) it claims, the
 * one an author writes. A descendant placement is relative to it.
 */
export interface PrimitiveScope {
  /** The element the primitive is: the tag it claims. */
  readonly self: string;
  /** The elements it paints, and what it decides for each. */
  readonly paints: readonly OwnedPaint[];
}

/**
 * What a primitive claims: the elements it paints, and where each has to sit.
 *
 * The claim is AUTHORED; the ownership in a `PrimitiveScope` is derived from
 * the rules and checked against it.
 */
export interface Claim {
  /** The element the primitive is: the tag it claims. */
  readonly self: string;
  /** The elements it paints. */
  readonly paints: readonly Paint[];
}

/**
 * The decisions an element's look is made of.
 *
 * A property belongs to exactly one of them, so "the element owns the
 * background" is a question with an answer rather than a mood. The names are
 * the system's: a fill is the painted appearance of an element — the theme's
 * surfaces, inks, borders and accents.
 */
export type PaintKey =
  | "background"
  | "ink"
  | "edge"
  | "corner"
  | "elevation"
  | "face"
  | "weight"
  | "size"
  | "tracking"
  | "case"
  | "decoration"
  | "opacity";

/** Every decision, in the order the vocabulary lists them. */
export const PAINT_KEYS: readonly PaintKey[] = [
  "background",
  "ink",
  "edge",
  "corner",
  "elevation",
  "face",
  "weight",
  "size",
  "tracking",
  "case",
  "decoration",
  "opacity",
];

/**
 * The decision a CSS property belongs to.
 *
 * A property that paints nothing a primitive owns — a margin, a display — has
 * no decision: it is layout, and layout is the author's call.
 */
export function paintKeyOf(property: string): PaintKey | undefined {
  if (property === "border-radius") return "corner";
  if (property.startsWith("border")) return "edge";
  if (property.startsWith("outline")) return "edge";
  if (property.startsWith("text-decoration")) return "decoration";
  if (property === "text-underline-offset") return "decoration";
  if (property === "background-color") return "background";
  if (property === "color") return "ink";
  if (property === "box-shadow") return "elevation";
  if (property === "font-family") return "face";
  if (property === "font-weight") return "weight";
  if (property === "font-size") return "size";
  if (property === "letter-spacing") return "tracking";
  if (property === "text-transform") return "case";
  if (property === "opacity") return "opacity";
  return undefined;
}

/**
 * The selector for a painted element, in the place the scope says.
 *
 * A descendant is reached through the primitive's own element, and `:where()`
 * is what keeps the reach from adding weight: the painted element's own
 * specificity is unchanged by where it sits, so scoping a primitive does not
 * quietly change which of two rules wins.
 */
export function painted(
  mode: Mode,
  self: string,
  where: Placement,
  tag: string,
): string {
  const subject = claim(mode, tag);
  if (where !== "descendant") return `:is(${subject})`;
  return `:where(${claim(mode, self)}) :is(${subject})`;
}
