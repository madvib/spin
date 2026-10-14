import { cssVarName, indexTree, valuesInMode } from "@spin/theme";
import type { TokenTree } from "@spin/theme";

export interface TokenRow {
  path: string;
  variable: string;
  value: string;
  /** The theme's own declared type for this token, e.g. `color`, `dimension`. */
  type: string;
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
        // The theme declares what a token IS, and the editor follows it: a
        // color gets a picker, a dimension gets a step control. Letting one
        // control imply every token's type is how radius ends up with a
        // hex-only field.
        type: (leaf.type as string | undefined) ?? "",
      };
    });
}

/**
 * Every custom property the theme declares, keyed by the variable it emits.
 *
 * A readout that names a component's tokens has to name the thing the user
 * edits — the token path — not `--color-primary`, which is the emitted
 * variable and therefore output. Showing output in an editor is a category
 * error: it looks actionable and is not.
 *
 * Built from the live tree rather than by inverting the name, because a
 * segment can contain a hyphen and a reverse mapping would be ambiguous.
 */
export function tokenPathsByVar(
  tree: TokenTree,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    out.set(cssVarName(leaf.path), leaf.path.join("."));
  }
  return out;
}

/** Which editor route owns a token path, so a readout can link to it. */
export function editorRouteFor(path: string): string {
  for (const [section, prefixes] of Object.entries(SECTION_PREFIXES)) {
    if (
      prefixes.some((prefix) =>
        prefix.every((segment, i) => path.split(".")[i] === segment)
      )
    ) {
      return `/${section}`;
    }
  }
  return "/";
}

