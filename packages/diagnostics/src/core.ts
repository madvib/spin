/**
 * The checks' contract: the facts, the findings, and the normalized code
 * view every check takes. Checks live beside this file (one module per
 * check, pipeline in `./semantic.ts`); adapters build the inputs and
 * report what comes back. Nothing here imports a linter, reads a file,
 * or knows what a theme document looks like.
 */

import type { Tier } from "./tiers.ts";
import type { Decision } from "./properties.ts";
import type { Surfaces } from "./surface.ts";
import type { ScopeFact } from "@spinjs/preset";

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
  /**
   * How bad this finding is, when the finding knows better than the rule.
   *
   * The rule's stance is the default — a problem is an error, a
   * suggestion a warning — and a finding that carries its own stance
   * overrides it.
   */
  readonly severity?: "error" | "warning";
}

/** The facts the decisions are made from. A provider fills this in. */
export interface Facts {
  /** False means the rules abstain rather than guess. */
  readonly readable: boolean;
  /** Every class the vocabulary can produce. */
  readonly utilities: ReadonlySet<string>;
  /** The classes the primitives define themselves. */
  readonly variants: ReadonlySet<string>;
  /** What each primitive paints, and what it decides for each element. */
  readonly scopes: readonly ScopeFact[];
  /** The tier of each utility, by the catalog group that produces it. */
  readonly tiers: ReadonlyMap<string, Tier>;
  /** The decision each utility makes, by its name. */
  readonly paints: ReadonlyMap<string, Decision>;
  /** The prefixes a variant carries: `hover:`, `md:`, … */
  readonly prefixes: ReadonlySet<string>;
  /** The project's own shortcuts. `null` means the declaration could not be read. */
  readonly shortcuts: ReadonlyMap<string, readonly string[]> | null;
  /** The colours the themes declare. */
  readonly colors: ReadonlySet<string>;
  /** The inks among them — the colours named `on-…`. */
  readonly inks: ReadonlySet<string>;
  /** The theme's own values, by custom property name. */
  readonly values: ReadonlyMap<string, string>;
  /** The theme's token paths, by custom property name. */
  readonly paths: ReadonlyMap<string, string>;
  /** What the theme puts on elements, and what a class sets. Read by running the preset's own rules. */
  readonly surfaces: Surfaces;
  /** The project's own component tags beyond the primitives' claimed scopes. */
  readonly components: readonly string[];
  /** The icon collections the project declares, across its brands and config. Empty means unenforced. */
  readonly iconCollections: ReadonlySet<string>;
  /** The saved glyphs the project holds, as the `i-<collection>-<name>` classes that name them. */
  readonly savedIcons: ReadonlySet<string>;
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

// Every check, beside this contract in its own module.
export { checkClosedVocabulary } from "./closed-vocabulary.ts";
export { checkNoHandwrittenTokens, checkNoUnpairedInk } from "./pairing.ts";
export { checkNoRedundantClass } from "./no-redundant-class.ts";
export { checkPreferElement } from "./prefer-element.ts";
export { checkPreferThemeValue, type Family } from "./prefer-theme-value.ts";
export {
  claimedBy,
  coreName,
  isReported,
  isSubject,
  namesOf,
  nounOf,
  ownersOf,
  readings,
  removalOf,
  variantDecisionValue,
  type Reading,
} from "./semantic.ts";
export type { Ancestor } from "./surface.ts";
export type { Placement, ScopeFact } from "@spinjs/preset";
