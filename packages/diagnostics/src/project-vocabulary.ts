/**
 * Per-project facts assembly over oracle vocabulary + theme leaves.
 *
 * `factsFor` builds the `Facts` the checks decide from: the utility
 * families, the claimed primitives, and the surfaces arrive through
 * `EngineAnswers` — filled by the engine, never reached for — and what
 * the themes can produce arrives through the shared oracle
 * (`deriveVocabulary`), never re-derived. The colours, values, and paths
 * come from the theme documents beside them.
 */

import {
  cssVarName,
  indexTree,
  parseTokens,
} from "@spinjs/theme";
import type { ThemeDocument, TokenTree } from "@spinjs/theme";
import { starterThemes } from "@spinjs/theme/themes";
import type { EngineAnswers } from "./engine-types.ts";
import { deriveVocabulary } from "./vocabulary.ts";
import type { Facts } from "./core.ts";
import { generatedClassesNow } from "./generated.ts";
import { paintKeyFor, type Tier, TIER_BY_GROUP } from "./tiers.ts";
import type { Decision } from "./properties.ts";
import { noShortcuts, type ShortcutDeclaration } from "./shortcuts.ts";
import type { Surfaces } from "./surface.ts";

/** The catalog group that holds the variant prefixes. */
const VARIANTS_GROUP = "variants";

/** The trees a set of documents parses to, in order. */
function treesOf(documents: readonly ThemeDocument[]): TokenTree[] {
  const out: TokenTree[] = [];
  for (const document of documents) {
    const parsed = parseTokens(document);
    if (!parsed.ok) continue;
    out.push(parsed.tree);
  }
  return out;
}

/**
 * The facts for a set of theme documents and the engine's answers about them.
 *
 * An empty set of documents is not "a theme with nothing in it" — it is a
 * vocabulary that could not be read, and the checks abstain rather than flag
 * every class in the file. The same is true of a project's shortcuts: a
 * configuration that declares shortcuts the lint could not read leaves a
 * vocabulary the lint cannot see, so the checks stand down there too.
 *
 * `generated` is the classes the engine produces beyond the families — the
 * ones wind4 answers for. They are added to the vocabulary, not to the
 * tiers: a class no family names has no tier, so the semantic check has
 * nothing to say about it.
 *
 * `shortcuts` is the project's own compositions, read from the project's
 * build configuration. Their names are vocabulary — a class the project
 * declared is a class the project produces — and what they expand to is
 * what the theme has to be able to make.
 */
export function factsFor(
  documents: readonly ThemeDocument[],
  answers: EngineAnswers,
  generated: ReadonlySet<string> = new Set(),
  shortcuts: ShortcutDeclaration = noShortcuts(),
  components: readonly string[] = [],
): Facts {
  const trees = treesOf(documents);
  if (trees.length === 0) return unreadable(answers.surfaces);

  const oracle = deriveVocabulary({ trees, answers, generated, shortcuts });
  // Shortcut names ride the oracle's utilities so the build's vocabulary is
  // one set; the lint keeps them in `shortcuts` instead, so a shortcut that
  // spends what the theme cannot make is still reported at its expansion.
  const utilities = new Set<string>(
    [...oracle.utilities].filter((utility) => !(utility in shortcuts.shortcuts)),
  );
  const tiers = new Map<string, Tier>();
  const paints = new Map<string, Decision>();
  for (const family of answers.families) {
    if (family.id === VARIANTS_GROUP) continue;
    const tier = TIER_BY_GROUP[family.id];
    if (tier === undefined) continue;
    for (const utility of family.utilities) {
      if (!tiers.has(utility)) tiers.set(utility, tier);
      // The decision a utility makes, by the family that produces it. A
      // family the map does not name makes no decision the checks speak of.
      const decision = paintKeyFor(utility, family.id);
      if (decision === undefined) continue;
      if (!paints.has(utility)) paints.set(utility, decision);
    }
  }
  const prefixes = oracle.prefixes;

  const colors = new Set<string>();
  for (const tree of trees) {
    for (const leaf of Object.values(indexTree(tree).leaves)) {
      if (leaf.type !== "color" || leaf.path[0] !== "color") continue;
      colors.add(leaf.path.slice(1).join("-"));
    }
  }
  const inks = new Set(
    [...colors].filter((name) => name.startsWith("on-")),
  );

  return {
    readable: true,
    utilities,
    variants: oracle.variants,
    scopes: [...answers.primitives.scopes],
    tiers,
    paints,
    prefixes,
    components,
    colors,
    inks,
    values: new Map(oracle.values),
    paths: pathsOf(trees),
    surfaces: answers.surfaces,
    // A declaration the checks could not read leaves the vocabulary
    // incomplete: the check that asks "can this be produced?" stands down,
    // and the rest of the facts still stand.
    //
    // Only the project's own table is vocabulary: a class the project
    // declares in its build configuration is a class the project produces.
    // The preset ships no shortcuts of its own, so nothing is seeded here.
    shortcuts: shortcuts.unreadable ? null : new Map(
      Object.entries(shortcuts.shortcuts).map((
        [name, value],
      ) => [name, shortcutParts(value)] as const),
    ),
  };
}

/**
 * A shortcut's classes, whether it was written as one string or a list.
 *
 * A project's table may already be a list; an object literal kept in a
 * constant of the config reads as Uno's string form. The vocabulary stores
 * the parts either way, so the check that reads what a shortcut expands to
 * reads classes and not characters.
 */
function shortcutParts(value: string | readonly string[]): readonly string[] {
  return typeof value === "string" ? value.split(/\s+/).filter(Boolean) : value;
}


/**
 * The theme's token paths, by custom property name.
 *
 * The path is the token's own name in the document, and the variable is the
 * generator's spelling of it. A theme that renames a token renames both, so
 * the path is what a reader asks for.
 */
function pathsOf(trees: readonly TokenTree[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const tree of trees) {
    for (const leaf of Object.values(indexTree(tree).leaves)) {
      out.set(cssVarName(leaf.path), leaf.path.join("."));
    }
  }
  return out;
}

/**
 * The facts of a vocabulary nobody could read.
 */
function unreadable(surfaces: Surfaces): Facts {
  return {
    readable: false,
    utilities: new Set(),
    variants: new Set(),
    scopes: [],
    tiers: new Map(),
    paints: new Map(),
    components: [],
    prefixes: new Set(),
    colors: new Set(),
    inks: new Set(),
    values: new Map(),
    paths: new Map(),
    surfaces,
    shortcuts: null,
  };
}

/**
 * The facts of a project: its own themes, and the starters beside them.
 *
 * The starters are the fallback, not the owned set: a project that has forked
 * a theme still serves the others, so both are in the vocabulary. And the
 * project's own theme is read LAST, because a value is the project's
 * answer: where the project and the starter it was forked from disagree,
 * the project is what the pages render.
 */
export function projectFacts(
  projectThemes: Record<string, ThemeDocument>,
  answers: EngineAnswers,
  generated: ReadonlySet<string> = generatedClassesNow(),
  shortcuts: ShortcutDeclaration = noShortcuts(),
  components: readonly string[] = [],
): Facts {
  return factsFor(
    [...Object.values(starterThemes), ...Object.values(projectThemes)],
    answers,
    generated,
    shortcuts,
    components,
  );
}
