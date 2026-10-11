import { cssVarName, indexTree, valuesInMode } from "@spin/theme";
import type { TokenTree } from "@spin/theme";

export interface TokenRow {
  path: string;
  variable: string;
  value: string;
}

const SECTION_PREFIXES: Record<string, string[][]> = {
  "background": [["color"]],
  "text-color": [["color"]],
  "border": [["color"]],
  "padding": [["spacing"]],
  "margin": [["spacing"]],
  "gap": [["spacing"]],
  "sizing": [["spacing"], ["breakpoint"]],
  "type-size": [["font", "size"]],
  "font": [["font", "family"], ["font", "weight"]],
  "radius": [["radius"]],
  "shadow": [["shadow"]],
  "position": [["spacing"], ["breakpoint"], ["z-index"]],
  "transitions": [["motion"]],
  "divide": [["color"]],
};

function formatValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}
export function sectionTokens(
  tree: TokenTree,
  sectionId: string,
  mode: string = "light",
): TokenRow[] {
  const prefixes = SECTION_PREFIXES[sectionId] ?? [];
  return groupTokens(tree, prefixes, mode);
}

export function groupTokens(
  tree: TokenTree,
  prefixes: string[][],
  mode: string = "light",
): TokenRow[] {
  if (prefixes.length === 0) return [];
  const index = indexTree(tree);
  // The theme answers what a token is worth in the active mode. It used to be
  // a walk of a `dark` group that no longer exists, so dark mode edited blind
  // — showing the base value while writing the override.
  const effective = valuesInMode(tree, mode);
  return Object.values(index.leaves)
    .filter((leaf) =>
      prefixes.some((prefix) =>
        prefix.every((segment, i) => leaf.path[i] === segment)
      )
    )
    .map((leaf) => {
      const path = leaf.path.join(".");
      return {
        path,
        variable: cssVarName(leaf.path),
        value: formatValue(effective.get(path) ?? leaf.value),
      };
    });
}
