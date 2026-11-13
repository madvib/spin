/**
 * The shared pipeline the semantic rules read.
 *
 * Three rules ask three questions about the same classes — dead weight,
 * second opinion, wrong element — so the reading is shared, not copied:
 * what each class sets, what the element already sets, which decision the
 * class makes, and whether the tier counts. What is NOT shared lives with
 * the check that needs it; what every check reads lives here.
 */


import { isNativeElement } from "./html.ts";
import { sameValue, type Decision, decisionOf } from "./properties.ts";
import { tierInPlace, type Tier } from "./tiers.ts";
import type {
  ScopeFact,
  ClassFacts,
  Facts,
  SemanticOptions,
  SemanticTags,
  Strictness,
  TextEdit,
} from "./core.ts";

/**
 * The class name a variant prefix leaves behind.
 *
 * `hover:bg-primary` is `bg-primary` under a state, and the tier of a
 * utility does not change with the state it is in. A prefix the vocabulary
 * does not know is left alone: `md:flex` is only a variant if `md:` is a
 * breakpoint the theme declares. wind4's attribute variants ride in the
 * preset (`data-[…]:`, `aria-[…]:`, `group-*:`/`peer-*:`): the bracket
 * carries the selector, so any `data-`/`aria-` head is a prefix by shape.
 */
export function coreName(
  cls: string,
  prefixes: ReadonlySet<string>,
): string {
  const parts = cls.split(":");
  if (parts.length === 1) return cls;
  for (const part of parts.slice(0, -1)) {
    if (/^(data|aria)-/.test(part)) continue;
    if (/^(group|peer)(-.+)?$/.test(part)) continue;
    if (!prefixes.has(`${part}:`)) return cls;
  }
  return parts[parts.length - 1] as string;
}

/**
 * Whether a tag counts as semantic under the dial.
 *
 * Spin's own elements are the tags the primitives claim that HTML does not
 * define: the theme states something about those, and the rules may speak
 * about what it stated. A component is one of them only when the project
 * claims it in `facts.components` — the theme says nothing about what an
 * unclaimed component renders, so the rules leave those alone.
 */
function isSemanticTag(
  facts: Facts,
  tag: string,
  setting: SemanticTags,
): boolean {
  if (setting === "none") return false;
  if (setting === "all") return true;
  const native = isNativeElement(tag);
  if (setting === "native") return native;
  if (native) return false;
  return facts.scopes.some((scope) =>
    scope.tag === tag || scope.self === tag
  ) ||
    facts.components.includes(tag);
}

/** Whether a tier is reported under the strictness dial. */
export function isReported(tier: Tier, strictness: Strictness): boolean {
  if (tier === "layout") return false;
  if (tier === "skin") return true;
  return strictness === "strict";
}

/**
 * One class on one element, as the checks read it.
 *
 * The reading is what the three rules need: what the class sets, what the
 * element already sets, and which decision the class makes.
 */
export interface Reading {
  /** The class as the author wrote it. */
  readonly cls: string;
  /** The declarations the class sets. */
  readonly declarations: ReadonlyMap<string, string>;
  /** The decision the class makes, when it makes one. */
  readonly decision: Decision | undefined;
  /** The tier of the class, in the place it is used. */
  readonly tier: Tier;
  /** Whether the class is dead weight where it stands. */
  readonly dead: boolean;
  /** The properties the class and the element both set. */
  readonly shared: readonly string[];
}

/**
 * The classes of an element, read.
 *
 * A class the primitives define themselves is skipped: a variant is how a
 * primitive is told to change, and the theme's own variants are the
 * sanctioned way to spend it. A class under a state is skipped too: the
 * element's resting value is not the value the state sees, and comparing
 * the two would be comparing two different things.
 */
export function readings(
  facts: Facts,
  node: ClassFacts,
  options: SemanticOptions,
): Reading[] {
  const tag = node.tag;
  if (tag === undefined) return [];
  if (!isSemanticTag(facts, tag, options.semanticTags)) return [];
  // The element as it stands: where it sits, and what it wears. A variant
  // speaks over the base, so the surface the classes are compared against is
  // the one the browser would see.
  const element = facts.surfaces.element(
    tag,
    node.ancestors ?? [],
    node.classes,
  );
  const out: Reading[] = [];
  for (const cls of node.classes) {
    // An element wearing `bare` has opted out of its primitive's paint,
    // typography, and padding to style itself with utilities: a utility
    // there is the author's own decision, not a fight with the theme.
    if (cls === "bare" || coreName(cls, facts.prefixes) === "bare") {
      return [];
    }
    if (facts.variants.has(cls)) continue;
    const core = coreName(cls, facts.prefixes);
    if (facts.variants.has(core)) continue;
    if (core !== cls) continue;
    const tier = facts.tiers.get(core);
    if (tier === undefined) continue;
    const declarations = facts.surfaces.utility(core);
    if (declarations.size === 0) continue;
    const shared = [...declarations.keys()].filter((property) =>
      element.has(property)
    );
    const dead = shared.length === declarations.size && shared.every(
      (property) =>
        sameValue(
          declarations.get(property) as string,
          element.get(property) as string,
          facts.values,
        ),
    );
    out.push({
      cls,
      declarations,
      decision: facts.paints.get(core),
      tier: tierInPlace(tier, [...declarations.keys()], element),
      dead,
      shared,
    });
  }
  return out;
}

/**
 * The decisions the element's own variants have claimed.
 *
 * A variant is how a primitive is told to change, and what it sets is the
 * element's look and not the base's: a button that wears `bare` has no fill
 * and no edge, whatever the base said. So the decisions a variant speaks
 * about belong to the variant, and the scope that painted the element by
 * default no longer owns them.
 *
 * The ink follows the fill: the ink is the foreground OF a fill, so a variant
 * that speaks about the fill speaks about the ink with it. A button with no
 * fill has no foreground to be — which is why the bare button leaves its ink
 * to the utilities, and why an author who wants the page's ink on one spells
 * `text-text`.
 */
export function claimedBy(facts: Facts, node: ClassFacts): ReadonlySet<Decision> {
  const tag = node.tag;
  if (tag === undefined) return NO_DECISIONS;
  const out = new Set<Decision>();
  const worn = facts.surfaces.worn(tag, node.ancestors ?? [], node.classes);
  for (const property of worn.keys()) {
    const decision = decisionOf(property);
    if (decision === undefined) continue;
    out.add(decision);
  }
  if (out.has("background")) out.add("ink");
  return out;
}

/**
 * The value the element's worn variants set for a decision.
 *
 * Read off the variants alone — not the full class list — so the answer is
 * what the variant says, not what the class under test re-states. `undefined`
 * when no worn variant speaks about the decision.
 */
export function variantDecisionValue(
  facts: Facts,
  node: ClassFacts,
  decision: Decision,
): string | undefined {
  const tag = node.tag;
  if (tag === undefined) return undefined;
  const worn = facts.surfaces.variants(tag, node.classes);
  if (worn.length === 0) return undefined;
  const declarations = facts.surfaces.worn(tag, node.ancestors ?? [], worn);
  for (const [property, value] of declarations) {
    if (decisionOf(property) === decision) return value;
  }
  // The ink follows the fill: a variant that clears the fill leaves the ink
  // to the author, so a variant with a fill value but no ink value still
  // claims the ink — with the fill's value standing in for it.
  if (decision === "ink") {
    for (const [property, value] of declarations) {
      if (decisionOf(property) === "background") return value;
    }
  }
  return undefined;
}

/** The empty set of decisions, for an element that claims nothing. */
const NO_DECISIONS: ReadonlySet<Decision> = new Set<Decision>();

/**
 * The primitives that paint this element, and decide something about it.
 *
 * A descendant scope needs to know where the element sits: the chain above
 * it is the only thing that says whether it is inside the column a document
 * surface owns. An adapter that cannot supply the chain reports the element
 * as unpainted — a silence, not a wrong answer.
 */
export function ownersOf(facts: Facts, node: ClassFacts): ScopeFact[] {
  const tag = node.tag;
  if (tag === undefined) return [];
  const out: ScopeFact[] = [];
  for (const scope of facts.scopes) {
    if (!isSubject(scope, node)) continue;
    if (scope.where === "descendant" && !insideScope(scope, node)) continue;
    out.push(scope);
  }
  return out;
}

/**
 * Whether the element is the one the scope paints.
 *
 * Tag-only: classless is the whole premise, so a scope matches the
 * element's tag and nothing else. `class="card"` on any element is
 * content, never a subject claim.
 */
export function isSubject(scope: ScopeFact, node: ClassFacts): boolean {
  return node.tag !== undefined && node.tag === scope.tag;
}

/**
 * Whether the element sits inside the primitive's own element.
 */
function insideScope(scope: ScopeFact, node: ClassFacts): boolean {
  for (const ancestor of node.ancestors ?? []) {
    if (ancestor.tag !== undefined && ancestor.tag === scope.self) return true;
  }
  return false;
}

/**
 * The word a decision is named by in a message.
 *
 * The fill is the system's word for the painted appearance of an element —
 * the theme's surfaces, inks, borders and accents — so a decision about the
 * fill is one word whether it is the background, the ink or the edge. The
 * text's own decisions are named by what they are: the scale, the weight,
 * the typeface, the tracking, the letter case.
 */
export function nounOf(decision: Decision | undefined): string {
  if (decision === "size") return "size";
  if (decision === "weight") return "weight";
  if (decision === "face") return "typeface";
  if (decision === "tracking") return "tracking";
  if (decision === "case") return "letter case";
  if (decision === "decoration") return "decoration";
  return "fill";
}

/**
 * The variant names, as a message names them.
 *
 * Two of them are enough to say what a variant is, and the rest are there
 * for the author to look up.
 */
export function namesOf(variants: readonly string[]): string {
  const named = variants.slice(0, 2).map((name) => "`" + name + "`").join(", ");
  return variants.length > 2 ? named + ", …" : named;
}

/**
 * The edit that drops a class from an element.
 *
 * The class goes, and the space that touched it goes with it — otherwise
 * the list is left with a gap in it. The space after is preferred, because
 * the space before may be the one a neighbouring class is leaving with.
 */
export function removalOf(
  node: ClassFacts,
  index: number,
): TextEdit | undefined {
  const tokens = node.tokens;
  const token = tokens?.[index];
  if (token === undefined) return undefined;
  if (tokens !== undefined && tokens.length === 1 && node.attributeRange !== undefined) {
    return { range: node.attributeRange, text: "" };
  }
  const [start, end] = token.range;
  if (token.spaceAfter) return { range: [start, end + 1], text: "" };
  if (token.spaceBefore) return { range: [start - 1, end], text: "" };
  return { range: [start, end], text: "" };
}

/**
 * The edit that writes a style where a removed utility stood.
 *
 * The replacement keeps the list tidy by construction: it covers the
 * class's own range only, so no space goes with it.
 */
export function replacementOf(
  node: ClassFacts,
  index: number,
  text: string,
): TextEdit | undefined {
  const token = node.tokens?.[index];
  if (token === undefined) return undefined;
  const [start, end] = token.range;
  return { range: [start, end], text };
}
