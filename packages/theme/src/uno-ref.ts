/**
 * The uno theme object, built once from a tree.
 *
 * A token's name is derived from its path, once, here — and everywhere else a
 * name is a *value*. The name IS the custom property's own name, minus the
 * leading `--`: the variable namespace is flat, so the property is the token's
 * identity, and there is no second vocabulary to keep in step.
 *
 * The values are references rather than literals, which is what makes a theme
 * live: the map holds `var(--color-primary)` and the browser resolves it
 * against whatever stylesheet declared it. `generateCss` builds the same name
 * with the same `cssVarName`, so the engine and the stylesheet cannot disagree.
 *
 * What this module deliberately does NOT have: a table of which token groups
 * are "exposed". The projection is total — every leaf of the tree is in the
 * map — so there is no row to forget, and the readers that once kept such a
 * table (and the audits that grew around it) are gone.
 */

import { cssVarName, indexTree } from "./pipeline/resolve.ts";
import type { TokenTree } from "./pipeline/types.ts";

/**
 * Every token of a tree, keyed by its custom property name without the
 * leading `--`, each value the `var()` reference to it.
 */
export type ThemeRef = Record<string, string>;

/**
 * The map key a dotted token path addresses.
 *
 * Dotted and dashed spellings name the same property — `font.family.sans`
 * and `font-family-sans` are `--font-family-sans` either way — so a caller
 * can write the path the document uses and a caller that only has a class
 * name can paste its dashes; both land on the same entry.
 */
export function themeKey(path: string): string {
  return path.split(".").join("-");
}

export function themeRef(tree: TokenTree): ThemeRef {
  const out: ThemeRef = {};
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    const name = cssVarName(leaf.path);
    out[name.slice(2)] = `var(${name})`;
  }
  return out;
}
