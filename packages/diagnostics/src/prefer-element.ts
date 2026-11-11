/**
 * A class that reaches for a decision the theme gave another element.
 *
 * The theme gave the size to the heading, and the fill to the button; a
 * class that carries that decision on an element the theme does not type is
 * the markup asking for something the theme already answered elsewhere. The
 * element that carries it is named, because the advice is only useful if it
 * says which element to reach for.
 *
 * The stance is split, and the line is drawn by ownership:
 *
 * - Exactly one element carries the value (single-carrier) for a
 *   typographic decision (size/face/tracking/ink): the class is a
 *   paragraph wearing a heading's size, a box wearing a quotation's face —
 *   and that is an ERROR with the element named as the remedy.
 * - Several elements carry the value (multi-carrier): the theme offers more
 *   than one way to say it, and which one the author meant is a question
 *   the lint cannot answer. The rule names one and stays advisory — a
 *   suggestion, not a ban.
 *
 * Inline text stays silent: a `span` inside a paragraph is emphasis, not a
 * paragraph manqué — the prose already types it, so there is no reach.
 */

import { isTypography, sameValue, type Decision } from "./properties.ts";
import {
  claimedBy,
  coreName,
  nounOf,
  ownersOf,
  readings,
} from "./semantic.ts";
import type {
  ClassFacts,
  Facts,
  Finding,
  SemanticOptions,
} from "./core.ts";
import { DEFAULT_SEMANTIC_OPTIONS } from "./core.ts";

export function checkPreferElement(
  facts: Facts,
  node: ClassFacts,
  options: SemanticOptions = DEFAULT_SEMANTIC_OPTIONS,
): Finding[] {
  const tag = node.tag;
  if (tag === undefined) return [];
  const owners = ownersOf(facts, node);
  const claimed = claimedBy(facts, node);
  const out: Finding[] = [];
  for (const reading of readings(facts, node, options)) {
    // A named style stays silent: styles attach to any element by design
    // (placement-open), so wearing one is never a reach for another
    // element's decision. The style's whole tuple shares values with many
    // elements, and naming the first of those would be naming noise — the
    // rule has nothing to say about where a style sits.
    if (coreName(reading.cls, facts.prefixes).startsWith("type-")) continue;
    const decision = reading.decision;
    if (decision === undefined) continue;
    // The decoration family is not this rule's. A control's `text-decoration:
    // none` is a RESET, not a themed answer, and "the element already says
    // that" is the redundancy rule's business — and it says it correctly.
    // A tag-based push is not advice either: it moves authors toward divs.
    if (decision === "decoration") continue;
    // The element's own variant has claimed the decision, so the decision is
    // accounted for here and is not another element's to carry.
    if (claimed.has(decision)) continue;
    if (owners.some((owner) => owner.owns.includes(decision))) continue;
    // The ink of the fill the element wears is the fill's own pairing, not
    // a reach for another element: `text-on-primary` on `bg-primary` is
    // what the palette pairs there, and the pairing rule — not this one —
    // says when it is wrong.
    if (decision === "ink" && wearsPairedFill(facts, node, reading)) continue;
    // Inline text is the prose's own: a `span` inside a paragraph is
    // emphasis, not a paragraph manqué. The prose types what it holds, so a
    // typographic class there is not a reach for another element.
    if (isTypography(decision) && insideProseText(facts, node)) continue;
    const carriers = carriersOf(facts, decision, reading);
    if (carriers.length === 0) continue;
    const element = carriers[0] as string;
    const single = carriers.length === 1 && isTypography(decision);
    out.push({
      messageId: single ? "error" : "element",
      data: {
        tag,
        cls: reading.cls,
        element,
        decision: nounOf(decision),
      },
      position: node.position,
      remedy: "Put the class on `<" + element + ">" + (single ? "" : " or drop it") + ".",
    });
  }
  return out;
}

/**
 * Whether the element sits inside prose text.
 *
 * The prose column types what it holds — paragraphs, quotations, runs of
 * code, emphasis — so a span inside any element the prose scopes paint is
 * already typed. Only the native inline elements read here: a component tag
 * is not the browser's, and the lint knows nothing about what it renders.
 */
function insideProseText(facts: Facts, node: ClassFacts): boolean {
  const ancestors = node.ancestors ?? [];
  if (ancestors.length === 0) return false;
  const proseTags = new Set(
    facts.scopes
      .filter((scope) => scope.primitive === "prose")
      .map((scope) => scope.tag),
  );
  return ancestors.some((ancestor) =>
    ancestor.tag !== undefined && proseTags.has(ancestor.tag)
  );
}

/**
 * Whether the element wears the fill an ink is paired with.
 *
 * `text-on-primary` pairs `bg-primary`: the ink names its fill after the
 * `on-` prefix, in whatever state the ink is in. A state-prefixed ink pairs
 * the state-prefixed fill, the same way the pairing rule reads them.
 */
function wearsPairedFill(
  facts: Facts,
  node: ClassFacts,
  reading: { cls: string },
): boolean {
  const core = coreName(reading.cls, facts.prefixes);
  if (!core.startsWith("text-on-")) return false;
  const state = reading.cls.slice(0, reading.cls.length - core.length);
  const fill = `${state}bg-${core.slice("text-on-".length)}`;
  return node.classes.includes(fill);
}

/**
 * The elements the theme gave a decision to, with that value.
 *
 * The element is found by the VALUE: the theme gave the size to the heading
 * whose size it is, and the fill to the control whose fill it is. An
 * element that owns the decision but sets a different value is a different
 * answer, and naming it would be naming the wrong element.
 *
 * A generic fill on a layout box is a box fill, not a claim to be a
 * control: `bg-surface-sunken` on a `<div>` is a panel, not a `<dialog>`,
 * and `bg-primary` on a `<span>` is an avatar, not a `<button>`. The same
 * holds for the shape, the shadow, and the edge: `rounded-full` on a badge
 * dot is a dot, not a `<progress>`; `shadow-lg` on a floating panel is a
 * panel, not a `<dialog>`; and a `border-t` on a composer bar or an arrow
 * tip is a hairline, not a `<hr>`. Only the typographic decisions and the
 * ink can name an owner — the scale, the face, and the line are what
 * elements are typed by.
 */
function carriersOf(
  facts: Facts,
  decision: Decision,
  reading: { declarations: ReadonlyMap<string, string> },
): string[] {
  if (
    decision === "background" || decision === "corner" ||
    decision === "elevation" || decision === "edge"
  ) return [];
  // A weight step alone is not a badge: `font-medium` on text is emphasis,
  // not a claim to be `<badge>`. The scale owns the decision, not the chip.
  if (decision === "weight") return [];
  const found: string[] = [];
  for (const scope of facts.scopes) {
    if (!scope.owns.includes(decision)) continue;
    const surface = facts.surfaces.element(scope.tag, []);
    let carries = false;
    for (const [property, value] of reading.declarations) {
      const own = surface.get(property);
      if (own === undefined) continue;
      const matches = decision === "ink"
        ? value === own
        : sameValue(value, own, facts.values);
      if (!matches) continue;
      carries = true;
      break;
    }
    if (carries && !found.includes(scope.tag)) found.push(scope.tag);
  }
  // A shared palette ink names no element: `--color-text-muted` is worn by
  // `<card-description>`, `<stat-title>`, `<blockquote>` and more, so
  // `text-muted` on a `<span>` is not a reach for any one of them. A
  // dedicated ink worn by a single element (`text-link` -> `<a>`) still
  // names its owner.
  if (decision === "ink" && found.length > 1) return [];
  return found;
}
