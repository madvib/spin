/**
 * A class that says something else where the theme has already said.
 *
 * The element owns the decision — the theme's own answer for how it looks —
 * and the class says a different one. That is a second opinion about a
 * decision the system owns, and a one-off override is BANNED: the theme is
 * where decisions recur, so a single class that fights it is a decision
 * that will not recur, and it cannot be one the system stands behind.
 *
 * So the finding is an error, and it names the way out: the theme's value,
 * or — for the painted look — the variant the element declares.
 */

import { paintKeyOf } from "../compiler/index.ts";
import { isTypography, type Decision } from "./properties.ts";
import {
  claimedBy,
  isReported,
  namesOf,
  ownersOf,
  readings,
  type Reading,
} from "./semantic.ts";
import type {
  Ancestor,
  ClassFacts,
  Facts,
  Finding,
  ScopeFact,
  SemanticOptions,
} from "./core.ts";
import { DEFAULT_SEMANTIC_OPTIONS } from "./core.ts";

/**
 * The families a one-off override falls into.
 *
 * - **typography** — the text's own shape: the scale it is read in, the
 *   weight, the family, the capitalisation, the tracking. The theme states
 *   it for the elements it types.
 * - **skin** — the painted appearance: colour, background, border, radius,
 *   shadow. A primitive states it for the element it paints.
 * - **spacing** — the space between blocks, where the theme types the
 *   element and states its rhythm.
 */
export type Family = "typography" | "skin" | "spacing";

export function checkPreferThemeValue(
  facts: Facts,
  node: ClassFacts,
  options: SemanticOptions = DEFAULT_SEMANTIC_OPTIONS,
): Finding[] {
  const tag = node.tag;
  if (tag === undefined) return [];
  // The escape excuses one-off display type the theme cannot name: the
  // author said so on the element, so an override here is the escape's
  // business, not a second opinion about the element's own value.
  if (node.escaped === true) return [];
  const owners = ownersOf(facts, node);
  const claimed = claimedBy(facts, node);
  const out: Finding[] = [];
  for (const reading of readings(facts, node, options)) {
    if (!isReported(reading.tier, options.strictness)) continue;
    if (reading.dead) continue;
    const decision = reading.decision;
    // A decision the element's own variant has claimed is the VARIANT's
    // answer, not the scope's: the scope no longer owns it. A class that
    // sets it is either the variant's own answer or a deliberate override,
    // and neither is a second opinion about the scope.
    if (decision !== undefined && claimed.has(decision)) continue;
    const holder = holderOf(owners, decision);
    const spacing = reading.tier === "spacing";
    if (holder === undefined && !spacing) continue;
    const family = familyOf(reading, decision);
    const remedy = remedyOf(
      family,
      family === "spacing"
        ? sizeVariants(facts, owners, node)
        : variantsOf(facts, holder, tag, node, decision),
    );
    out.push({
      messageId: "override",
      data: {
        tag,
        cls: reading.cls,
        family,
        claim: claimOf(family, tag, decision),
        remedy,
      },
      position: node.position,
      remedy,
    });
  }
  return out;
}

/**
 * The primitive that owns a decision for this element, when one does.
 *
 * The scope is what says the element is painted and what the painting
 * decides; the owner is the one whose claim carries the decision.
 */
function holderOf(
  owners: readonly ScopeFact[],
  decision: Decision | undefined,
): ScopeFact | undefined {
  if (decision === undefined) return undefined;
  return owners.find((owner) => owner.owns.includes(decision));
}

/**
 * The family an override falls into.
 *
 * The spacing tier is the theme's rhythm wherever the theme types the
 * element; a decision about the text's own shape is typography; everything
 * else the element owns is its skin.
 */
function familyOf(reading: Reading, decision: Decision | undefined): Family {
  if (reading.tier === "spacing") return "spacing";
  if (decision !== undefined && isTypography(decision)) return "typography";
  return "skin";
}

/**
 * The claim: who owns the decision the class overrides.
 *
 * The theme states the type scale, so a typed element's text is the
 * theme's; a primitive paints its own element, so its fill is the
 * element's; and the space between blocks is the theme's rhythm wherever
 * the theme types the element.
 */
function claimOf(
  family: Family,
  tag: string,
  decision: Decision | undefined,
): string {
  if (family === "spacing") return "the theme owns the space between blocks";
  const noun = nounOf(decision);
  if (family === "skin") return "`<" + tag + ">` sets its own " + noun;
  return "the theme sets the " + noun + " of `<" + tag + ">`";
}

/**
 * The word a decision is named by in an override message.
 *
 * The fill is the system's word for the painted appearance of an element —
 * the theme's surfaces, inks, borders and accents — so a decision about the
 * fill is one word whether it is the background, the ink or the edge. The
 * text's own decisions are named by what they are: the scale, the weight,
 * the typeface, the tracking, the letter case.
 */
function nounOf(decision: Decision | undefined): string {
  if (decision === "size") return "size";
  if (decision === "weight") return "weight";
  if (decision === "face") return "typeface";
  if (decision === "tracking") return "tracking";
  if (decision === "case") return "letter case";
  if (decision === "decoration") return "decoration";
  return "fill";
}

/**
 * The remedy: what to write instead of the override.
 *
 * A variant is how a primitive is told to change its own look, so the skin
 * family's way out is a variant — named, when the element declares any —
 * and the theme's value is the way out of the rest.
 *
 * The spacing family has a way out of its own on a CONTROL: the space inside
 * a control is the size of that control, and the theme's answer to the size
 * is a variant.
 */
function remedyOf(family: Family, variants: readonly string[]): string {
  if ((family === "skin" || family === "spacing") && variants.length > 0) {
    return "Use a variant (" + namesOf(variants) + ") or the theme's value.";
  }
  return "Use the theme's value.";
}

/**
 * The size variants the element's own scope declares.
 *
 * A size variant is the one that changes the size the element is read in —
 * and with it the space inside it: a smaller control has less padding, and
 * that padding is the theme's answer to how big the control is. So the way
 * out of a spacing override on a control is the variant and not a step.
 *
 * The variants are found by what they set: the variant that sets the
 * element's size is the one that speaks about its size. A variant the
 * element already wears is not offered — telling an author to use the
 * variant they are using is not advice.
 */
function sizeVariants(
  facts: Facts,
  owners: readonly ScopeFact[],
  node: ClassFacts,
): readonly string[] {
  const tag = node.tag;
  if (tag === undefined) return [];
  const worn = facts.surfaces.variants(tag, node.classes);
  const out: string[] = [];
  for (const owner of owners) {
    // A variant belongs to the primitive's OWN element: the card's variants
    // belong to the card, not to the title the card paints.
    if (owner.tag !== owner.self) continue;
    for (const name of facts.surfaces.variants(tag, owner.variants)) {
      if (out.includes(name) || worn.includes(name)) continue;
      const declarations = facts.surfaces.worn(
        tag,
        node.ancestors ?? [],
        [name],
      );
      if (!declarations.has("font-size")) continue;
      out.push(name);
    }
  }
  return out;
}

/**
 * The variants the element may be told to wear.
 *
 * A variant is a class on the primitive's OWN element: the card's variants
 * belong to the card, not to the title the card paints. So the variants are
 * named only where the painted element IS the primitive — and only those
 * that paint it, because a primitive declares classes that are not variants
 * of its element (the icon slot is a class on a child).
 */
function variantsOf(
  facts: Facts,
  holder: ScopeFact | undefined,
  tag: string,
  node: ClassFacts,
  decision: Decision | undefined,
): readonly string[] {
  if (holder === undefined) return [];
  if (holder.tag !== holder.self) return [];
  // A variant the element already wears is not offered: telling an author to
  // use the variant they are using is not advice.
  const worn = facts.surfaces.variants(tag, node.classes);
  return facts.surfaces.variants(tag, holder.variants).filter((name) => {
    if (worn.includes(name)) return false;
    if (decision === undefined) return true;
    // And a variant that says nothing about the decision is not a way out of
    // it: offering one sends the author to a door that does not open.
    return carries(
      facts,
      tag,
      node.ancestors ?? [],
      name,
      decision,
    );
  });
}

/**
 * Whether a variant carries a decision.
 *
 * A variant carries what it sets. The ink follows the fill here as it does
 * everywhere else: a variant that clears the fill leaves the ink to the
 * author, and so carries the ink too.
 */
function carries(
  facts: Facts,
  tag: string,
  ancestors: readonly Ancestor[],
  name: string,
  decision: Decision,
): boolean {
  const declarations = facts.surfaces.worn(tag, ancestors, [name]);
  let fill = false;
  for (const property of declarations.keys()) {
    const claimed = paintKeyOf(property);
    if (claimed === decision) return true;
    if (claimed === "background") fill = true;
  }
  return decision === "ink" && fill;
}
