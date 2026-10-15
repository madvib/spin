import { cssVarName, indexTree, valuesInMode } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { ROUTES } from "./routes.ts";

export interface TokenRow {
  path: string;
  variable: string;
  value: string;
  /** The theme's declared type for this token, e.g. `color`, `dimension`. */
  type: string;
}

function formatValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

/** A length in px at the 16px root; undefined for a value that is not a length. */
export function toPx(value: string): number | undefined {
  if (value.trim() === "0") return 0;
  const rem = value.trim().match(/^(-?[\d.]+)rem$/);
  if (rem) return Number(rem[1]) * 16;
  const px = value.trim().match(/^(-?[\d.]+)px$/);
  if (px) return Number(px[1]);
  return undefined;
}

export function groupTokens(
  tree: TokenTree,
  prefixes: string[][],
  mode: string = "light",
): TokenRow[] {
  if (prefixes.length === 0) return [];
  const index = indexTree(tree);
  // The theme answers what a token is worth in the active mode.
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
        // The declared type picks the control: a color gets a picker, a
        // dimension a step control.
        type: (leaf.type as string | undefined) ?? "",
      };
    });
}

/** Every custom property the theme declares, keyed by the variable it emits. */
export function tokenPathsByVar(
  tree: TokenTree,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const leaf of Object.values(indexTree(tree).leaves)) {
    out.set(cssVarName(leaf.path), leaf.path.join("."));
  }
  return out;
}

/** Which editor route owns a token path; a group no editor owns answers `/`. */
export function editorRouteFor(path: string): string {
  const segments = path.split(".");
  const owned = ROUTES.find((route) =>
    // `in`, because the table is a tuple of literals: an entry with no
    // `owns` has no such field at all.
    "owns" in route &&
    route.owns.some((prefix) =>
      prefix.every((segment, i) => segments[i] === segment)
    )
  );
  return owned?.path ?? "/";
}
