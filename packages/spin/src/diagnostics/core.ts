/**
 * The rules' decisions, with no linter in them.
 *
 * A linter is a delivery mechanism; the decision belongs to spin. Everything
 * in this module takes two things — the facts (the vocabulary, the
 * primitives' claims, the theme's own values) and a normalized view of the
 * code — and answers with findings. An adapter walks an AST, builds the
 * input, and reports what comes back: oxlint's plugin API today, ESLint's
 * tomorrow, a standalone CLI the day after.
 *
 * Nothing here imports a linter, reads a file, or knows what a theme
 * document looks like. That is what makes the answers portable, and it is
 * what makes them testable: a test hands the core a fact and a class list
 * and reads the findings.
 *
 * A finding may carry an EDIT: the range it covers and the text that
 * replaces it. The decision about what to change belongs here; the change
 * itself belongs to whoever is holding the file.
 */

import { paintKeyOf } from "../compiler/index.ts";
import { isNativeElement } from "./html.ts";
import { type Tier, tierInPlace } from "./tiers.ts";
import type { Decision } from "./properties.ts";
import { isTypography, sameValue } from "./properties.ts";
import type { Ancestor, Surfaces } from "./surface.ts";

/** Where a finding sits: the start of the node that caused it. */
export interface Position {
  readonly line: number;
  readonly column: number;
}

/**
 * A text edit: the range it covers, and what replaces it.
 *
 * The range is in the source's own offsets, which is the shape every
 * linter's fixer speaks — oxlint's, ESLint's, and the CLI's own writer.
 */
export interface TextEdit {
  readonly range: readonly [number, number];
  readonly text: string;
}

/**
 * What a rule found.
 *
 * `messageId` is the rule's public vocabulary — the id in `meta.messages` —
 * and `data` fills the template. An adapter passes both to the linter and
 * lets the linter render the sentence, so the wording lives in one place
 * whichever linter is asking.
 */
export interface Finding {
  /** The message id — the rule's public vocabulary. */
  readonly messageId: string;
  /** The values the message template interpolates. */
  readonly data: Record<string, string>;
  /** Where the finding is. */
  readonly position: Position;
  /** The edit that settles the finding, when the finding has one. */
  readonly fix?: TextEdit;
  /**
   * What to do about the finding, in the rule's own words.
   *
   * A rule that says only what is wrong leaves the author to work out the
   * repair; the remedy is the way out, and it belongs to the rule that
   * found the thing. It is not one of the message's values: the message is
   * the complaint, and the remedy is the offer beside it.
   */
  readonly remedy?: string;
}

/**
 * The facts the decisions are made from.
 *
 * A provider fills this in: spin's own provider reads the project's theme
 * and the primitives' manifest. A test fills it in by hand. The core never
 * asks where the facts came from.
 */
export interface Facts {
  /**
   * Whether the vocabulary could be read at all.
   *
   * False means the rules abstain rather than guess: a rule that cannot see
   * the vocabulary would flag every class in the file, which is worse than
   * saying nothing.
   */
  readonly readable: boolean;
  /** Every class the vocabulary can produce. */
  readonly utilities: ReadonlySet<string>;
  /** The classes the primitives define themselves. */
  readonly variants: ReadonlySet<string>;
  /**
   * What each primitive paints, and what it decides for each element.
   *
   * A primitive paints INSIDE its scope: its own element, and — for the
   * document surface — the elements of the column it owns. The list is what
   * a scope-aware rule needs; a tag on its own says nothing about where the
   * painting lands.
   */
  readonly scopes: readonly ScopeFact[];
  /** The tier of each utility, by the catalog group that produces it. */
  readonly tiers: ReadonlyMap<string, Tier>;
  /**
   * The decision each utility makes, by its name.
   *
   * A tier says whether a utility counts as painting over an element; the
   * decision says WHICH. A background and a font weight are both skin, and
   * only one of them is a second opinion about an element's fill.
   */
  readonly paints: ReadonlyMap<string, Decision>;
  /** The prefixes a variant carries: `hover:`, `md:`, … */
  readonly prefixes: ReadonlySet<string>;
  /**
   * The project's own shortcuts: each name, and the classes it expands to.
   *
   * A shortcut is a real class — the project declared it, so the closed
   * vocabulary knows its name — and what it expands to is what the theme
   * has to be able to produce, or the shortcut styles nothing.
   *
   * `null` means the declaration could not be read: the project composes,
   * but the lint cannot see what. The rule that depends on the vocabulary
   * stands down then, and only that rule — the rest of the facts are
   * still worth enforcing.
   */
  readonly shortcuts: ReadonlyMap<string, readonly string[]> | null;
  /** The colours the themes declare. */
  readonly colors: ReadonlySet<string>;
  /** The inks among them — the colours named `on-…`. */
  readonly inks: ReadonlySet<string>;
  /**
   * The theme's own values, by custom property name.
   *
   * A value the theme resolves to is what two declarations are compared as:
   * `1px` and `var(--border-width)` are the same value when the theme's
   * border is a pixel wide, and they are the lint's business only then.
   */
  readonly values: ReadonlyMap<string, string>;
  /**
   * The theme's token paths, by custom property name.
   *
   * The path is the token's name in the theme — `color.border-strong` — and
   * the variable is what the generator makes of it. A rule that says which
   * token an author meant says the path, because the path is what a reader
   * asks for and the variable is what the generator emits.
   */
  readonly paths: ReadonlyMap<string, string>;
  /**
   * What the theme puts on elements, and what a class sets.
   *
   * Read by running the preset's own rules, so the lint cannot disagree
   * with the stylesheet the theme ships.
   */
  readonly surfaces: Surfaces;
  /**
   * The project's own component tags: the custom elements the runtime
   * serves beyond the primitives' claimed scopes.
   *
   * A tag here is a tag the `spin` dial treats as semantic — the project
   * knows what its own components render, so the rules may reason about
   * them. Empty by default: nothing claimed, nothing treated.
   */
  readonly components: readonly string[];
}

/**
 * Where a primitive's painting lands.
 *
 * - **global** — the element is painted wherever it is.
 * - **descendant** — the element is painted only inside the primitive's own
 *   element.
 */
export type Placement = "global" | "descendant";

/**
 * What a primitive paints, as the lint reads it.
 *
 * The scope is the primitives' own declaration: the manifest carries it, and
 * the lint does not decide it.
 */
export interface ScopeFact {
  /** The primitive that paints it. */
  readonly primitive: string;
  /** The element the primitive is: the tag (or class) it claims. */
  readonly self: string;
  /** The tag of the painted element. */
  readonly tag: string;
  /** Where the painted element has to sit for the primitive to paint it. */
  readonly where: Placement;
  /** The decisions the primitive owns for it. */
  readonly owns: readonly string[];
  /**
   * The variants the primitive declares.
   *
   * A variant is a class the author types on the primitive's OWN element —
   * the card's variants belong to the card, not to the title the card
   * paints — so the rule that names a variant asks whether the painted
   * element IS the primitive before it names one.
   */
  readonly variants: readonly string[];
}

/**
 * How much the semantic rules report.
 *
 * - `strict` — skin, structure and spacing all count as painting over the
 *   element's own decision. The default, and the strictest reading.
 * - `balanced` — only skin counts. A type size on a text element is a
 *   decision about content, and a project that wants it free says so.
 * - `lenient` — none of it counts. The rules stand down; the closed
 *   vocabulary still speaks.
 */
export type Strictness = "strict" | "balanced" | "lenient";

/**
 * Which tags the semantic rules treat as semantic.
 *
 * - `all` — every tag the markup writes. The default.
 * - `native` — only the elements HTML defines.
 * - `spin` — only spin's own elements: the tags the primitives claim that
 *   HTML does not define. A component is neither — the theme says nothing
 *   about what a component renders.
 * - `none` — no tag is semantic, and the rules say nothing.
 */
export type SemanticTags = "all" | "native" | "spin" | "none";

/** The dial the semantic rules read. */
export interface SemanticOptions {
  readonly strictness: Strictness;
  readonly semanticTags: SemanticTags;
}

/**
 * What the semantic rules do when nothing says otherwise.
 *
 * The default is `native`: the lint reads markup, and a component's tag is
 * not a tag the browser owns — nothing in the lint can say what such a tag
 * renders, so the rules must not reason about it. A project that knows its
 * own components reads them with the `spin` dial, which is the primitives'
 * claimed non-native tags.
 */
export const DEFAULT_SEMANTIC_OPTIONS: SemanticOptions = {
  strictness: "strict",
  semanticTags: "native",
};

/**
 * The class name a variant prefix leaves behind.
 *
 * `hover:bg-primary` is `bg-primary` under a state, and the tier of a
 * utility does not change with the state it is in. A prefix the vocabulary
 * does not know is left alone: `md:flex` is only a variant if `md:` is a
 * breakpoint the theme declares.
 */
export function coreName(
  cls: string,
  prefixes: ReadonlySet<string>,
): string {
  const parts = cls.split(":");
  if (parts.length === 1) return cls;
  for (const part of parts.slice(0, -1)) {
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
function isReported(tier: Tier, strictness: Strictness): boolean {
  if (tier === "layout") return false;
  if (tier === "skin") return true;
  return strictness === "strict";
}

/**
 * A class the preset cannot generate.
 *
 * The vocabulary is the project's own theme, catalogued — so a class the
 * theme can produce is known, and a class nothing produces is not. The
 * primitives' own variants are known too: they are classes the system
 * defines, even though no theme names them.
 *
 * The project's own shortcuts are known for the same reason: a class the
 * project declared is a class the project produces. What the shortcut
 * EXPANDS to is checked as well — a shortcut that spends a class the theme
 * cannot make styles nothing, and that is worth saying out loud.
 *
 * A class the theme cannot produce is DEAD: it renders nothing, so dropping
 * it changes nothing. The finding therefore carries the edit that drops it.
 */
export function checkClosedVocabulary(
  facts: Facts,
  node: ClassFacts,
): Finding[] {
  if (!facts.readable) return [];
  // The project composes, and the lint cannot see what it composed: the
  // vocabulary is incomplete, and a class the project declared would be
  // reported as one it does not know. The rule says nothing rather than
  // say the wrong thing.
  if (facts.shortcuts === null) return [];
  const out: Finding[] = [];
  for (const [index, cls] of node.classes.entries()) {
    if (facts.variants.has(cls)) continue;
    if (facts.utilities.has(cls)) continue;
    const core = coreName(cls, facts.prefixes);
    if (facts.utilities.has(core)) continue;
    if (facts.variants.has(core)) continue;
    // Icon glyphs come from the icon preset, not the token vocabulary.
    if (core.startsWith("i-")) continue;
    const shortcut = facts.shortcuts.get(cls) ?? facts.shortcuts.get(core);
    if (shortcut !== undefined) {
      for (const part of shortcut) {
        if (producible(facts, part)) continue;
        out.push({
          messageId: "shortcut",
          data: { shortcut: cls, cls: part },
          position: node.position,
          remedy: "Change what `" + cls + "` expands to, or drop it.",
        });
      }
      continue;
    }
    out.push({
      messageId: "unknown",
      data: { cls },
      position: node.position,
      fix: removalOf(node, index),
      remedy: "Drop `" + cls + "`",
    });
  }
  return out;
}

/**
 * Whether the vocabulary can produce a class.
 *
 * The same question the closed-vocabulary rule asks of a class in markup,
 * asked of the classes a shortcut spends: a variant prefix does not change
 * what a utility is, and an icon glyph comes from the icon preset.
 */
function producible(facts: Facts, cls: string): boolean {
  if (facts.utilities.has(cls)) return true;
  if (facts.variants.has(cls)) return true;
  if (cls.startsWith("i-")) return true;
  const core = coreName(cls, facts.prefixes);
  if (facts.utilities.has(core)) return true;
  if (facts.variants.has(core)) return true;
  return false;
}

/* --------------------------------------------------------------- the class -- */

/**
 * One class on one element, as the core reads it.
 *
 * The reading is what the three rules need: what the class sets, what the
 * element already sets, and which decision the class makes.
 */
interface Reading {
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
function readings(
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
 * A class that says what the element already says.
 *
 * DEAD WEIGHT: the class sets properties the element sets too, and it sets
 * them to the values the element already has. It changes nothing, so it can
 * be dropped — which is an edit, and the edit is what the finding carries.
 */
export function checkNoRedundantClass(
  facts: Facts,
  node: ClassFacts,
  options: SemanticOptions = DEFAULT_SEMANTIC_OPTIONS,
): Finding[] {
  const tag = node.tag;
  if (tag === undefined) return [];
  // A decision the element's own variant has claimed is the VARIANT's answer,
  // not the scope's — with one exception: when the class says EXACTLY what
  // the variant says, it is still dead weight. `secondary` wears the page's
  // ink, so `text-text` on a secondary button changes nothing and can go.
  // But a class that sets a DIFFERENT value than the worn variant's is the
  // variant's own answer or a deliberate override — `text-on-semantic-warning`
  // on a bare warning key IS the ink — and dropping it would change the
  // element. Only that second case stands down.
  const claimed = claimedBy(facts, node);
  const out: Finding[] = [];
  for (const reading of readings(facts, node, options)) {
    if (!isReported(reading.tier, options.strictness)) continue;
    if (!reading.dead) continue;
    if (reading.decision !== undefined && claimed.has(reading.decision)) {
      const variantValue = variantDecisionValue(facts, node, reading.decision);
      const classValue = reading.declarations.get(reading.shared[0] as string);
      if (
        variantValue === undefined || classValue === undefined ||
        !sameValue(variantValue, classValue, facts.values)
      ) continue;
    }
    const index = node.classes.indexOf(reading.cls);
    out.push({
      messageId: "redundant",
      data: {
        tag,
        cls: reading.cls,
        properties: reading.shared.join(", "),
      },
      position: node.position,
      fix: removalOf(node, index),
      remedy: "Drop `" + reading.cls + "`",
    });
  }
  return out;
}

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
export function checkPreferThemeValue(
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
function claimedBy(facts: Facts, node: ClassFacts): ReadonlySet<Decision> {
  const tag = node.tag;
  if (tag === undefined) return NO_DECISIONS;
  const out = new Set<Decision>();
  const worn = facts.surfaces.worn(tag, node.ancestors ?? [], node.classes);
  for (const property of worn.keys()) {
    const decision = paintKeyOf(property);
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
function variantDecisionValue(
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
    if (paintKeyOf(property) === decision) return value;
  }
  // The ink follows the fill: a variant that clears the fill leaves the ink
  // to the author, so a variant with a fill value but no ink value still
  // claims the ink — with the fill's value standing in for it.
  if (decision === "ink") {
    for (const [property, value] of declarations) {
      if (paintKeyOf(property) === "background") return value;
    }
  }
  return undefined;
}

/** The empty set of decisions, for an element that claims nothing. */
const NO_DECISIONS: ReadonlySet<Decision> = new Set<Decision>();

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

/**
 * The variant names, as a message names them.
 *
 * Two of them are enough to say what a variant is, and the rest are there
 * for the author to look up.
 */
function namesOf(variants: readonly string[]): string {
  const named = variants.slice(0, 2).map((name) => "`" + name + "`").join(", ");
  return variants.length > 2 ? named + ", …" : named;
}

/**
 * A class that reaches for a decision the theme gave another element.
 *
 * The theme gave the size to the heading, and the fill to the button; a
 * class that carries that decision on an element the theme does not type is
 * the markup asking for something the theme already answered elsewhere. The
 * element that carries it is named, because the advice is only useful if it
 * says which element to reach for.
 */
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
    if (!isReported(reading.tier, options.strictness)) continue;
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
    const element = ownerOf(facts, decision, reading);
    if (element === undefined) continue;
    out.push({
      messageId: "element",
      data: {
        tag,
        cls: reading.cls,
        element,
        decision: nounOf(decision),
      },
      position: node.position,
      remedy: "Put the class on `<" + element + ">`.",
    });
  }
  return out;
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
  reading: Reading,
): boolean {
  const core = coreName(reading.cls, facts.prefixes);
  if (!core.startsWith("text-on-")) return false;
  const state = reading.cls.slice(0, reading.cls.length - core.length);
  const fill = `${state}bg-${core.slice("text-on-".length)}`;
  return node.classes.includes(fill);
}

/**
 * The element the theme gave a decision to, with that value.
 *
 * The element is found by the VALUE: the theme gave the size to the heading
 * whose size it is, and the fill to the control whose fill it is. An
 * element that owns the decision but sets a different value is a different
 * answer, and naming it would be naming the wrong element.
 *
 * And when SEVERAL elements carry that value, the lint names none: the
 * theme offers more than one way to say it, and which one the author meant
 * is a question the lint cannot answer. The rule says nothing rather than
 * point at the wrong element.
 */
function ownerOf(
  facts: Facts,
  decision: Decision,
  reading: Reading,
): string | undefined {
  // A generic fill on a layout box is a box fill, not a claim to be a
  // control: `bg-surface-sunken` on a `<div>` is a panel, not a `<dialog>`,
  // and `bg-primary` on a `<span>` is an avatar, not a `<button>`. The same
  // holds for the shape, the shadow, and the edge: `rounded-full` on a badge
  // dot is a dot, not a `<progress>`; `shadow-lg` on a floating panel is a
  // panel, not a `<dialog>`; and a `border-t` on a composer bar or an arrow
  // tip is a hairline, not a `<hr>`. Only the typographic decisions and the
  // ink can name an owner — the scale, the face, and the line are what
  // elements are typed by.
  if (
    decision === "background" || decision === "corner" ||
    decision === "elevation" || decision === "edge"
  ) return undefined;
  // A weight step alone is not a badge: `font-medium` on text is emphasis,
  // not a claim to be `<badge>`. The scale owns the decision, not the chip.
  if (decision === "weight") return undefined;
  const found = new Set<string>();
  for (const scope of facts.scopes) {
    if (!scope.owns.includes(decision)) continue;
    const surface = facts.surfaces.element(scope.tag, []);
    for (const [property, value] of reading.declarations) {
      const own = surface.get(property);
      if (own === undefined) continue;
      if (!sameValue(value, own, facts.values)) continue;
      found.add(scope.tag);
      break;
    }
  }
  return found.size === 1 ? [...found][0] : undefined;
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
 * The primitives that paint this element, and decide something about it.
 *
 * A descendant scope needs to know where the element sits: the chain above
 * it is the only thing that says whether it is inside the column a document
 * surface owns. An adapter that cannot supply the chain reports the element
 * as unpainted — a silence, not a wrong answer.
 */
function ownersOf(facts: Facts, node: ClassFacts): ScopeFact[] {
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
 * Prose is base, not a toggleable component: prose scopes match by tag
 * only. There are no `.h1` classes — a `class="h1"` on any element is
 * content, never a subject claim. Custom-element dual matching (tag or
 * the primitive's own class) stays until C3b makes mode-awareness
 * deliberate.
 */
function isSubject(scope: ScopeFact, node: ClassFacts): boolean {
  if (scope.primitive === "prose") {
    return node.tag !== undefined && node.tag === scope.tag;
  }
  if (node.tag !== undefined && node.tag === scope.tag) return true;
  return node.classes.includes(scope.tag);
}

/**
 * Whether the element sits inside the primitive's own element.
 *
 * Prose is base: the column is `<prose>`, never `.prose` (see `isSubject`).
 */
function insideScope(scope: ScopeFact, node: ClassFacts): boolean {
  for (const ancestor of node.ancestors ?? []) {
    if (ancestor.tag !== undefined && ancestor.tag === scope.self) return true;
    if (scope.primitive === "prose") continue;
    if (ancestor.classes.includes(scope.self)) return true;
  }
  return false;
}

/**
 * An ink the palette does not pair with the fill underneath it.
 *
 * A fill constrains the ink of its OWN state: `hover:bg-accent` is the
 * hover state's pairing, and a chip that brightens its resting ink is not
 * painting that ink on the fill that arrives under a pointer. Inks are
 * collected per state for the same reason.
 */
export function checkNoUnpairedInk(
  facts: Facts,
  node: ClassFacts,
): Finding[] {
  if (!facts.readable) return [];
  const fills = new Map<string, string[]>();
  const inks = new Map<string, string[]>();
  for (const cls of node.classes) {
    const cut = cls.lastIndexOf(":");
    const state = cut === -1 ? "" : cls.slice(0, cut);
    const core = cut === -1 ? cls : cls.slice(cut + 1);
    if (core.startsWith("bg-")) {
      const fill = core.slice(3);
      // A surface is the page rather than a fill: body ink sits on it by
      // definition, which is where every floor is measured.
      if (facts.colors.has(fill) && !fill.startsWith("surface")) {
        fills.set(state, [...(fills.get(state) ?? []), fill]);
      }
    } else if (core.startsWith("text-")) {
      const ink = core.slice(5);
      if (facts.colors.has(ink)) {
        inks.set(state, [...(inks.get(state) ?? []), ink]);
      }
    }
  }
  const out: Finding[] = [];
  for (const [state, stated] of inks) {
    const painted = fills.get(state);
    if (painted === undefined) continue;
    for (const ink of stated) {
      for (const fill of painted) {
        const expected = `on-${fill}`;
        if (!facts.inks.has(expected)) {
          out.push({
            messageId: "undeclared",
            data: { ink: `text-${ink}`, fill },
            position: node.position,
            remedy: "Paint a paired fill, or declare the pairing in the theme.",
          });
        } else if (ink !== expected) {
          out.push({
            messageId: "mismatch",
            data: { ink: `text-${ink}`, fill, expected: `text-${expected}` },
            position: node.position,
            remedy: `Use \`${expected}\` on that fill`,
          });
        }
      }
    }
  }
  return out;
}

/**
 * A token referenced by hand.
 *
 * A custom property is generated output, never an interface. When a
 * component spends a token it reads the theme the generator already
 * injected, so a renamed token cannot leave it pointing at nothing and a
 * literal string cannot sit in the source where nothing checks it.
 */
export function checkNoHandwrittenTokens(
  facts: Facts,
  node: LiteralFacts,
): Finding[] {
  if (!facts.readable) return [];
  const out: Finding[] = [];
  for (const match of node.text.matchAll(/var\(\s*--([a-z0-9-]+)\s*\)/g)) {
    const token = match[1] as string;
    out.push({
      messageId: "handwritten",
      data: {
        token,
        group: token.split("-")[0] ?? "",
        step: token,
        // The token's path in the theme, which is what a reader asks for:
        // the variable is the generator's spelling of it, and the path is
        // the token's own name.
        path: facts.paths.get(`--${token}`) ?? token,
      },
      position: node.position,
      remedy: "Read the theme's token `" +
        (facts.paths.get(`--${token}`) ?? token) + "`.",
    });
  }
  return out;
}

/**
 * The edit that drops a class from an element.
 *
 * The class goes, and the space that touched it goes with it — otherwise
 * the list is left with a gap in it. The space after is preferred, because
 * the space before may be the one a neighbouring class is leaving with.
 */
function removalOf(
  node: ClassFacts,
  index: number,
): TextEdit | undefined {
  const token = node.tokens?.[index];
  if (token === undefined) return undefined;
  const [start, end] = token.range;
  if (token.spaceAfter) return { range: [start, end + 1], text: "" };
  if (token.spaceBefore) return { range: [start - 1, end], text: "" };
  return { range: [start, end], text: "" };
}

/** The classes of one element, and where it sits. */
export interface ClassFacts {
  /** The element's tag, when the attribute is on one. */
  readonly tag: string | undefined;
  /** The classes, split. */
  readonly classes: readonly string[];
  /**
   * Where each class sits in the source.
   *
   * A fix has to say WHICH text to remove, and the offsets are the only
   * thing that says so. An adapter that cannot supply them reports the
   * finding without an edit — the finding is still true, and the author can
   * still drop the class by hand.
   */
  readonly tokens?: readonly ClassToken[];
  /**
   * The elements above this one, nearest first.
   *
   * The scope of a primitive is a place, and a place is a chain: an element
   * is inside a document column only if the column is above it. An adapter
   * that cannot see the chain says nothing about the descendants, and the
   * rule stands down rather than guess.
   */
  readonly ancestors?: readonly AncestorFacts[];
  /** Where the attribute starts. */
  readonly position: Position;
}

/**
 * One class, and where it sits.
 *
 * The range is the class's own text in the source's offsets; the spaces say
 * whether the class is followed or preceded by one, which is what a fix
 * needs to leave the list tidy.
 */
export interface ClassToken {
  /** The class's name. */
  readonly name: string;
  /** The class's own range in the source. */
  readonly range: readonly [number, number];
  /** Whether a space sits before the class in the list. */
  readonly spaceBefore: boolean;
  /** Whether a space sits after the class in the list. */
  readonly spaceAfter: boolean;
}

/** One element above the one being read. */
export interface AncestorFacts {
  /** The ancestor's tag, when it has one. */
  readonly tag: string | undefined;
  /** The classes the ancestor carries. */
  readonly classes: readonly string[];
}

/** One string literal, and where it sits. */
export interface LiteralFacts {
  readonly text: string;
  readonly position: Position;
}
