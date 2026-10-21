/**
 * The rules' decisions, with no linter in them.
 *
 * A linter is a delivery mechanism; the decision belongs to spin. Everything
 * in this module takes two things — the facts (the vocabulary, the
 * primitives' claims, the palette's pairings) and a normalized view of the
 * code — and answers with findings. An adapter walks an AST, builds the
 * input, and reports what comes back: oxlint's plugin API today, ESLint's
 * tomorrow, a standalone CLI the day after.
 *
 * Nothing here imports a linter, reads a file, or knows what a theme
 * document looks like. That is what makes the answers portable, and it is
 * what makes them testable: a test hands the core a fact and a class list
 * and reads the findings.
 */

import { isNativeElement } from "./html.ts";
import { decisionOf, type Tier } from "./tiers.ts";

/** Where a finding sits: the start of the node that caused it. */
export interface Position {
  readonly line: number;
  readonly column: number;
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
  readonly paints: ReadonlyMap<string, string>;
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
  /** The pattern that matches a colour written by hand. */
  readonly rawColor: RegExp;
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
}

/**
 * How much the semantic rule reports.
 *
 * - `strict` — skin and structure both count as painting over the element's
 *   own decision. The default, and the strictest reading.
 * - `balanced` — only skin counts. A type size on a text element is a
 *   decision about content, and a project that wants it free says so.
 * - `lenient` — neither counts. The rule stands down; the closed vocabulary
 *   still speaks.
 */
export type Strictness = "strict" | "balanced" | "lenient";

/**
 * Which tags the semantic rule treats as semantic.
 *
 * - `all` — every tag a primitive claims. The default.
 * - `native` — only the elements HTML defines.
 * - `spin` — only spin's own elements.
 * - `none` — no tag is semantic, and the rule says nothing.
 */
export type SemanticTags = "all" | "native" | "spin" | "none";

/** The dial the semantic rule reads. */
export interface SemanticOptions {
  readonly strictness: Strictness;
  readonly semanticTags: SemanticTags;
}

/** What the semantic rule does when nothing says otherwise. */
export const DEFAULT_SEMANTIC_OPTIONS: SemanticOptions = {
  strictness: "strict",
  semanticTags: "all",
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

/** Whether a tag counts as semantic under the dial. */
function isSemanticTag(tag: string, setting: SemanticTags): boolean {
  if (setting === "none") return false;
  if (setting === "all") return true;
  const native = isNativeElement(tag);
  return setting === "native" ? native : !native;
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
  for (const cls of node.classes) {
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
        });
      }
      continue;
    }
    out.push({
      messageId: "unknown",
      data: { cls },
      position: node.position,
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

/**
 * A utility that paints over an element's own decision.
 *
 * A utility on a raw element is fine. A utility that overwrites how the
 * element looks is not: the element already decided, and the class is a
 * second opinion. Layout is free — where a box sits is the author's call.
 *
 * The decision is looked up in the SCOPE, not in a list of tags. A primitive
 * paints inside its own scope — its own element, and the elements of the
 * column it owns — so whether a utility is a second opinion depends on where
 * the element sits, and on which decision the primitive actually makes
 * about it. A paragraph the document surface does not own is the author's; a
 * button the button primitive owns is not.
 */
export function checkNoUtilitiesOnSemantic(
  facts: Facts,
  node: ClassFacts,
  options: SemanticOptions = DEFAULT_SEMANTIC_OPTIONS,
): Finding[] {
  const tag = node.tag;
  if (tag === undefined) return [];
  if (!isSemanticTag(tag, options.semanticTags)) return [];
  const owners = ownersOf(facts, node);
  if (owners.length === 0) return [];
  const out: Finding[] = [];
  for (const cls of node.classes) {
    // The primitives' own variants are how an element is told to change.
    if (facts.variants.has(cls)) continue;
    const core = coreName(cls, facts.prefixes);
    if (facts.variants.has(core)) continue;
    const tier = facts.tiers.get(core);
    if (tier === undefined) continue;
    if (!isReported(tier, options.strictness)) continue;
    const decision = facts.paints.get(core);
    if (decision === undefined) continue;
    // The owner has to own THIS decision: a control that sets its own fill
    // says nothing about the scale its text is read in, and a text element
    // that sets its own scale says nothing about the fill around it.
    if (!owners.some((owner) => owner.owns.includes(decision))) continue;
    out.push({
      messageId: "utility",
      data: { tag, cls, decision: decisionOf(tier) },
      position: node.position,
    });
  }
  return out;
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
 * By tag, or by the class the primitive claims it with: the same primitive
 * in its classless form claims `<card>` and in its class form claims
 * `.card`, and the lint does not know which mode a project runs.
 */
function isSubject(scope: ScopeFact, node: ClassFacts): boolean {
  if (node.tag !== undefined && node.tag === scope.tag) return true;
  return node.classes.includes(scope.tag);
}

/**
 * Whether the element sits inside the primitive's own element.
 */
function insideScope(scope: ScopeFact, node: ClassFacts): boolean {
  for (const ancestor of node.ancestors ?? []) {
    if (ancestor.tag !== undefined && ancestor.tag === scope.self) return true;
    if (ancestor.classes.includes(scope.self)) return true;
  }
  return false;
}

/**
 * A colour written by hand where a token belongs.
 *
 * A token utility names a theme colour; anything else in a colour position
 * is a literal the theme cannot change.
 */
export function checkNoRawColors(
  facts: Facts,
  node: ClassFacts,
): Finding[] {
  if (!facts.readable) return [];
  const out: Finding[] = [];
  for (const cls of node.classes) {
    if (facts.utilities.has(cls)) continue;
    if (!facts.rawColor.test(cls)) continue;
    out.push({
      messageId: "raw",
      data: { cls },
      position: node.position,
    });
  }
  return out;
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
          });
        } else if (ink !== expected) {
          out.push({
            messageId: "mismatch",
            data: { ink: `text-${ink}`, fill, expected: `text-${expected}` },
            position: node.position,
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
      data: { token, group: token.split("-")[0] ?? "", step: token },
      position: node.position,
    });
  }
  return out;
}

/** The classes of one element, and where it sits. */
export interface ClassFacts {
  /** The element's tag, when the attribute is on one. */
  readonly tag: string | undefined;
  /** The classes, split. */
  readonly classes: readonly string[];
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
