import { toUnoTheme, type UnoTheme } from "./uno.ts";
import type { TokenTree } from "@spin/theme";

/** Deep-merge `src` into `dst` (colors nest; later callers win per leaf). */
function mergeColors(
  dst: Record<string, unknown>,
  src: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(src)) {
    if (
      typeof value === "object" && value !== null &&
      typeof dst[key] === "object" && dst[key] !== null
    ) {
      mergeColors(
        dst[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      dst[key] = value;
    }
  }
}

/**
 * Merge every theme's Uno view, first theme wins per leaf — mirroring
 * `unionSets`. The factory feeds all themes so tooling and extendedTheme
 * fallbacks see later-theme tokens, not just the first theme's.
 */
export function buildTheme(trees: TokenTree[]): UnoTheme {
  const merged: UnoTheme = {
    colors: {},
    spacing: {},
    fontSize: {},
    fontFamily: {},
    fontWeight: {},
    radius: {},
    shadow: {},
    breakpoint: {},
    zIndex: {},
    transitionDuration: {},
    transitionTimingFunction: {},
  };
  // Reverse so earlier trees overwrite: first theme wins, later fill gaps.
  for (const tree of [...trees].reverse()) {
    const view = toUnoTheme(tree);
    mergeColors(merged.colors, view.colors);
    for (
      const key of [
        "spacing",
        "fontSize",
        "fontFamily",
        "fontWeight",
        "radius",
        "shadow",
        "breakpoint",
        "zIndex",
        "transitionDuration",
        "transitionTimingFunction",
      ] as const
    ) {
      Object.assign(merged[key], view[key]);
    }
  }
  return merged;
}
