/**
 * The one oracle: what the themes can produce, derived once.
 *
 * Three derivations of this set used to coexist — the lint's `factsFor`,
 * the build's `deadClasses`, and the generator probe — and each new family
 * had to land in all three or a surface silently disagreed. Every consumer
 * (oxlint/ESLint visitors, `spin lsp`, the bundler build)
 * reads this module instead: a family added once is known everywhere, and a
 */

import {
  animationVariants,
  type EngineAnswers,
} from "@spinjs/preset";
import type { TokenTree } from "@spinjs/theme";
import {
  cssVarName,
  indexTree,
  resolveAliases,
} from "@spinjs/theme";
import type { ShortcutDeclaration } from "./shortcuts.ts";

/** What `deriveVocabulary` reads: the themes, the engine, the probe, the project. */
export interface OracleInput {
  /** The parsed theme documents, in precedence order (later wins for values). */
  readonly trees: readonly TokenTree[];
  /** The engine's families and primitive variants. */
  readonly answers: EngineAnswers;
  /** The classes the generator produces beyond the families. */
  readonly generated: ReadonlySet<string>;
  /** The project's own compositions (names are vocabulary, kept by the build). */
  readonly shortcuts: ShortcutDeclaration;
}

/** What the themes can produce, derived once. */
export interface OracleVocabulary {
  /**
   * Every utility the catalog names, plus `generated`, plus shortcut names.
   *
   * Shortcut names ride here so the build's vocabulary is one set; the
   * lint filters them back out of `Facts.utilities` (they live in
   * `Facts.shortcuts` instead) so a shortcut that spends what the theme
   * cannot make is still reported at its expansion.
   */
  readonly utilities: ReadonlySet<string>;
  /** The primitives' own variants plus the animation layer's. */
  readonly variants: ReadonlySet<string>;
  /** The catalog's variant prefixes plus the theme's own breakpoint steps. */
  readonly prefixes: ReadonlySet<string>;
  /** The theme's own values, by custom property name (aliases followed). */
  readonly values: ReadonlyMap<string, string>;
}

/** The catalog group that holds the variant prefixes. */
const VARIANTS_GROUP = "variants";

/**
 * What the themes can produce, derived once.
 *
 * Moved verbatim from the lint's `factsFor` (the family loop, the
 * `VARIANTS_GROUP` prefix rule, the breakpoint/`max-` prefix read, the
 * `animationVariants()` union over the primitives' variants) and the
 * build's `deadClasses` (the values-map build, the shortcut-name fold):
 * behavior preservation is the requirement, so this moves code, not
 * redesigns it.
 */
export function deriveVocabulary(input: OracleInput): OracleVocabulary {
  const utilities = new Set<string>(input.generated);
  const prefixes = new Set<string>();
  for (const family of input.answers.families) {
    for (const utility of family.utilities) {
      utilities.add(utility);
      if (family.id === VARIANTS_GROUP) {
        prefixes.add(utility);
        continue;
      }
    }
  }

  // The breakpoints are the theme's own scale, so the prefixes that carry
  // them are read from the theme rather than listed.
  for (const tree of input.trees) {
    for (const leaf of Object.values(indexTree(tree).leaves)) {
      if (leaf.path[0] !== "breakpoint") continue;
      const name = leaf.path[1];
      if (name !== undefined) {
        prefixes.add(`${name}:`);
        prefixes.add(`max-${name}:`);
      }
    }
  }

  // The theme's resolved values, for the removed-type suggestion: a dead
  // `text-sm` names the style that reads that way, the way the lint remedy
  // does. Aliases followed, last document winning.
  const values = new Map<string, string>();
  for (const tree of input.trees) {
    const resolved = resolveAliases(tree);
    for (const leaf of Object.values(indexTree(resolved.tree).leaves)) {
      const value = leaf.value;
      if (value === undefined || value === null) continue;
      values.set(cssVarName(leaf.path), String(value));
    }
  }

  // The project's own compositions are vocabulary: a class the project
  // declared is a class the project produces.
  for (const name of Object.keys(input.shortcuts.shortcuts)) {
    utilities.add(name);
  }

  return {
    utilities,
    // The animation layer is vocabulary too: `animate-spin` is a real
    // class, not an unknown utility, and a check that flagged it would be
    // wrong.
    variants: new Set([...input.answers.primitives.variants, ...animationVariants()]),
    prefixes,
    values,
  };
}

/**
 * The CSS properties an inline `style` or style object must not set.
 *
 * One kebab-case spelling for both call sites. The JSX side (`rules.ts`)
 * held camelCase members alongside kebab (`backgroundColor`,
 * `borderColor`, `borderRadius`, `paddingInline`/`Block`/`Top`/`Right`/
 * `Bottom`/`Left`, `marginInline`/`Block`/`Top`/`Right`/`Bottom`/`Left`,
 * `fontFamily`/`Size`/`Weight`, `lineHeight`, `letterSpacing`,
 * `boxShadow`) — every one of which converts to a member the CSS-text
 * side already held, so the JSX spellings contribute no unique member.
 * The CSS-text side (`engine.ts`) additionally held the shorthands and
 * logical longhands the JSX object never named: `background`, `border`,
 * `border-width`, `border-style`, `font`, `padding-inline-start`,
 * `padding-inline-end`, `margin-inline-start`, `margin-inline-end`.
 * Everything else (`color`, `background-color`, `border-color`,
 * `border-radius`, `padding`, `padding-inline`/`block`/`top`/`right`/
 * `bottom`/`left`, `margin` and its seven, `font-family`/`size`/`weight`,
 * `line-height`, `letter-spacing`, `box-shadow`, `gap`) was in both.
 * Each side converts to kebab-case at the lookup boundary (the JSX side
 * decamelizes the prop name; CSS text is already lowercase), so this set
 * holds one spelling and both call sites agree.
 */
export const THEME_STYLE_PROPERTIES: ReadonlySet<string> = new Set([
  "color",
  "background",
  "background-color",
  "border",
  "border-color",
  "border-radius",
  "border-width",
  "border-style",
  "padding",
  "padding-inline",
  "padding-block",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "padding-inline-start",
  "padding-inline-end",
  "margin",
  "margin-inline",
  "margin-block",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "margin-inline-start",
  "margin-inline-end",
  "font",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "box-shadow",
  "gap",
]);
