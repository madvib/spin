/** Composable palette and spacing facets layered via data-palette and data-spacing. */

import type { ThemeDocument } from "../pipeline/types.ts";
import catppuccinPaletteDoc from "./catppuccin.palette.json" with { type: "json" };
import compactSpacingDoc from "./compact.spacing.json" with { type: "json" };
import spaciousSpacingDoc from "./spacious.spacing.json" with { type: "json" };
import terracottaPaletteDoc from "./terracotta.palette.json" with { type: "json" };

export const catppuccinPalette = catppuccinPaletteDoc as ThemeDocument;
export const terracottaPalette = terracottaPaletteDoc as ThemeDocument;
export const compactSpacing = compactSpacingDoc as ThemeDocument;
export const spaciousSpacing = spaciousSpacingDoc as ThemeDocument;

export const demoPalettes: Readonly<Record<string, ThemeDocument>> = {
  catppuccin: catppuccinPalette,
  terracotta: terracottaPalette,
};

export const demoSpacings: Readonly<Record<string, ThemeDocument>> = {
  compact: compactSpacing,
  spacious: spaciousSpacing,
};
