/**
 * The facts the core decides from — spin's own answer.
 *
 * The vocabulary is READ, never copied: the utility names come from the
 * preset's catalog, the element and variant names from the primitives'
 * manifest, the colour words from the themes' own tokens, and the fill/ink
 * pairings from the same documents. A rename therefore cannot leave a lint
 * enforcing a vocabulary that no longer exists, and a theme that declares a
 * new pairing is pairable immediately.
 *
 * The documents are the project's own themes plus the shipped starters.
 * That union is what the preset serves a project (`projectThemes` in
 * `packages/preset/src/plugin.ts`): the starters, forked by the files at the
 * project's root. A class the project's theme can produce is therefore known
 * here, and one no theme produces is not.
 */

import {
  cssVarName,
  indexTree,
  parseTokens,
  resolveAliases,
} from "@spin/theme";
import type { ThemeDocument, TokenTree } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";
import {
  describeCatalog,
  primitiveContracts,
  primitiveVariants,
} from "@spin/preset";
import { primitiveVariants as animationVariants } from "@spin/animation";
import type { Facts, ScopeFact } from "./core.ts";
import { generatedClasses } from "./generated.ts";
import { paintKeyFor, type Tier, TIER_BY_GROUP } from "./tiers.ts";
import type { Decision } from "./properties.ts";
import { noShortcuts, type ShortcutDeclaration } from "./shortcuts.ts";
import { surfacesFor } from "./surface.ts";

/** The catalog group that holds the variant prefixes. */
const VARIANTS_GROUP = "variants";

/**
 * The scopes the primitives declare.
 *
 * Read from the manifest, which carries each primitive's claim: the element
 * it is, and the elements it paints with the decision it makes about each.
 * The lint does not decide the scope — a scope that is a list of tags says
 * nothing about where the painting lands, and a rule built on one reports
 * every paragraph in the world.
 */
function scopesOf(): ScopeFact[] {
  const out: ScopeFact[] = [];
  for (const [name, contract] of Object.entries(primitiveContracts)) {
    for (const paint of contract.scope.paints) {
      out.push({
        primitive: name,
        self: contract.scope.self,
        tag: paint.tag,
        where: paint.where,
        owns: paint.owns,
        variants: contract.variants,
      });
    }
  }
  return out;
}

/**
 * The weight steps the themes declare.
 *
 * The catalog puts the families and the weights in one group — `font-mono`
 * and `font-semibold` are both a font — and the rule asks which DECISION a
 * utility makes: a face or a weight. The names come from the theme, so a
 * theme that names a weight of its own is read correctly.
 */
function weightNames(trees: readonly TokenTree[]): Set<string> {
  const out = new Set<string>();
  for (const tree of trees) {
    for (const leaf of Object.values(indexTree(tree).leaves)) {
      if (leaf.path[0] !== "font" || leaf.path[1] !== "weight") continue;
      const step = leaf.path[2];
      if (step !== undefined) out.add(step);
    }
  }
  return out;
}

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
 * The facts for a set of theme documents.
 *
 * An empty set of documents is not "a theme with nothing in it" — it is a
 * vocabulary that could not be read, and the rules abstain rather than flag
 * every class in the file. The same is true of a project's shortcuts: a
 * configuration that declares shortcuts the lint could not read leaves a
 * vocabulary the lint cannot see, so the rules stand down there too.
 *
 * `generated` is the classes the preset produces beyond the catalog — the
 * ones wind4 answers for. They are added to the vocabulary, not to the
 * tiers: a class the catalog does not name has no tier, so the semantic
 * rule has nothing to say about it.
 *
 * `shortcuts` is the project's own compositions, read from the project's
 * build configuration. Their names are vocabulary — a class the project
 * declared is a class the project produces — and what they expand to is
 * what the theme has to be able to make.
 */
export function factsFor(
  documents: readonly ThemeDocument[],
  generated: ReadonlySet<string> = new Set(),
  shortcuts: ShortcutDeclaration = noShortcuts(),
): Facts {
  const trees = treesOf(documents);
  if (trees.length === 0) return unreadable();

  const catalog = new Set<string>();
  const utilities = new Set<string>(generated);
  const tiers = new Map<string, Tier>();
  const paints = new Map<string, Decision>();
  const prefixes = new Set<string>();
  const weights = weightNames(trees);
  for (const tree of trees) {
    for (const section of describeCatalog(tree)) {
      for (const utility of section.utilities) {
        catalog.add(utility);
        utilities.add(utility);
        if (section.id === VARIANTS_GROUP) {
          prefixes.add(utility);
          continue;
        }
        const tier = TIER_BY_GROUP[section.id];
        if (tier === undefined) continue;
        if (!tiers.has(utility)) tiers.set(utility, tier);
        // The decision a utility makes. A group that says only "font" needs
        // the name to say whether it is a face or a weight.
        const decision = paintKeyFor(utility, section.id, weights);
        if (decision === undefined) continue;
        if (!paints.has(utility)) paints.set(utility, decision);
      }
    }
  }

  // The breakpoints are the theme's own scale, so the prefixes that carry
  // them are read from the theme rather than listed.
  for (const tree of trees) {
    for (const leaf of Object.values(indexTree(tree).leaves)) {
      if (leaf.path[0] !== "breakpoint") continue;
      const name = leaf.path[1];
      if (name !== undefined) prefixes.add(`${name}:`);
    }
  }

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
    // The animation layer is vocabulary too: `animate-spin` is a real
    // class, not an unknown utility, and a lint that flagged it would be
    // wrong.
    variants: new Set([...primitiveVariants(), ...animationVariants()]),
    scopes: scopesOf(),
    tiers,
    paints,
    prefixes,
    colors,
    inks,
    values: valuesOf(trees),
    surfaces: surfacesFor(documents),
    // A declaration the lint could not read leaves the vocabulary
    // incomplete: the rule that asks "can this be produced?" stands down,
    // and the rest of the facts still stand.
    shortcuts: shortcuts.unreadable ? null : shortcuts.shortcuts,
  };
}

/**
 * The theme's own values, by custom property name.
 *
 * The values are the ones the theme resolved to: an alias is followed, so
 * the value a comparison reads is the value the browser would compute. A
 * theme that says the same thing twice — a project's own theme and the
 * starter it was forked from — is read in the order the documents came in,
 * so the last one is the answer.
 */
function valuesOf(trees: readonly TokenTree[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const tree of trees) {
    const resolved = resolveAliases(tree);
    for (const leaf of Object.values(indexTree(resolved.tree).leaves)) {
      const value = leaf.value;
      if (value === undefined || value === null) continue;
      out.set(cssVarName(leaf.path), String(value));
    }
  }
  return out;
}

/** The facts of a vocabulary nobody could read. */
function unreadable(): Facts {
  return {
    readable: false,
    utilities: new Set(),
    variants: new Set(),
    scopes: [],
    tiers: new Map(),
    paints: new Map(),
    prefixes: new Set(),
    colors: new Set(),
    inks: new Set(),
    values: new Map(),
    surfaces: surfacesFor([]),
    shortcuts: null,
  };
}

/**
 * The facts of a project: its own themes, and the starters beside them.
 *
 * The starters are the fallback, not the floor: a project that has forked
 * a theme still serves the others, so both are in the vocabulary. And the
 * project's own theme is read LAST, because a value is the project's
 * answer: where the project and the starter it was forked from disagree,
 * the project is what the pages render.
 */
export function projectFacts(
  projectThemes: Record<string, ThemeDocument>,
  generated: ReadonlySet<string> = generatedClasses,
  shortcuts: ShortcutDeclaration = noShortcuts(),
): Facts {
  return factsFor(
    [...Object.values(starterThemes), ...Object.values(projectThemes)],
    generated,
    shortcuts,
  );
}
