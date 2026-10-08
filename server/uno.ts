import { parseTokens } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { starterThemes } from "@spin/theme/themes";

/** Every starter goes to the preset, so every theme's variables ship. */
export const ALL_THEMES = starterThemes;

/**
 * The catalog is derived from a THEME, so it needs one parsed — and it must
 * be the TREE, because that is what `describeCatalog` walks.
 *
 * Parsed once: the catalog is asked for on every utilities request and a
 * parse is not free.
 */
let themeTree: TokenTree | undefined;
export function themeTreeOrParse(): TokenTree {
  if (themeTree === undefined) {
    const parsed = parseTokens(ALL_THEMES.default);
    if (!parsed.ok) throw new Error(parsed.error);
    themeTree = parsed.tree;
  }
  return themeTree;
}
