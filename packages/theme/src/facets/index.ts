/** Composable palette and spacing facets layered via data-palette and data-spacing. */

import type { DesignLanguageName } from "../languages/index.ts";
import type { ThemeDocument } from "../pipeline/types.ts";
import auroraPaletteDoc from "./aurora.palette.json" with { type: "json" };
import bauhausPaletteDoc from "./bauhaus.palette.json" with { type: "json" };
import botanicalPaletteDoc from "./botanical.palette.json" with { type: "json" };
import catppuccinPaletteDoc from "./catppuccin.palette.json" with { type: "json" };
import ceramicPaletteDoc from "./ceramic.palette.json" with { type: "json" };
import compactSpacingDoc from "./compact.spacing.json" with { type: "json" };
import eucalyptusPaletteDoc from "./eucalyptus.palette.json" with { type: "json" };
import graphitePaletteDoc from "./graphite.palette.json" with { type: "json" };
import nordicPaletteDoc from "./nordic.palette.json" with { type: "json" };
import ochrePaletteDoc from "./ochre.palette.json" with { type: "json" };
import risographPaletteDoc from "./risograph.palette.json" with { type: "json" };
import rosewaterPaletteDoc from "./rosewater.palette.json" with { type: "json" };
import spaciousSpacingDoc from "./spacious.spacing.json" with { type: "json" };
import terracottaPaletteDoc from "./terracotta.palette.json" with { type: "json" };

export const auroraPalette = auroraPaletteDoc as ThemeDocument;
export const bauhausPalette = bauhausPaletteDoc as ThemeDocument;
export const botanicalPalette = botanicalPaletteDoc as ThemeDocument;
export const catppuccinPalette = catppuccinPaletteDoc as ThemeDocument;
export const ceramicPalette = ceramicPaletteDoc as ThemeDocument;
export const eucalyptusPalette = eucalyptusPaletteDoc as ThemeDocument;
export const graphitePalette = graphitePaletteDoc as ThemeDocument;
export const nordicPalette = nordicPaletteDoc as ThemeDocument;
export const ochrePalette = ochrePaletteDoc as ThemeDocument;
export const risographPalette = risographPaletteDoc as ThemeDocument;
export const rosewaterPalette = rosewaterPaletteDoc as ThemeDocument;
export const terracottaPalette = terracottaPaletteDoc as ThemeDocument;
export const compactSpacing = compactSpacingDoc as ThemeDocument;
export const spaciousSpacing = spaciousSpacingDoc as ThemeDocument;

export interface LanguagePaletteOption {
  readonly id: string;
  readonly label: string;
  readonly document: ThemeDocument;
}

export const languageDefaultPaletteLabels: Readonly<Record<DesignLanguageName, string>> = {
  editorial: "Crimson",
  minimal: "Cobalt",
  neobrutalist: "Vermilion",
  material: "Indigo",
  neumorphic: "Aluminum",
  glassmorphic: "Iris",
};

export const languagePalettes: Readonly<Record<DesignLanguageName, readonly LanguagePaletteOption[]>> = {
  editorial: [
    { id: "terracotta", label: "Terracotta", document: terracottaPalette },
    { id: "botanical", label: "Botanical", document: botanicalPalette },
  ],
  minimal: [
    { id: "graphite", label: "Graphite", document: graphitePalette },
    { id: "catppuccin", label: "Catppuccin", document: catppuccinPalette },
  ],
  neobrutalist: [
    { id: "bauhaus", label: "Bauhaus", document: bauhausPalette },
    { id: "risograph", label: "Risograph", document: risographPalette },
  ],
  material: [
    { id: "eucalyptus", label: "Eucalyptus", document: eucalyptusPalette },
    { id: "ochre", label: "Ochre", document: ochrePalette },
  ],
  neumorphic: [
    { id: "ceramic", label: "Ceramic", document: ceramicPalette },
    { id: "nordic", label: "Nordic", document: nordicPalette },
  ],
  glassmorphic: [
    { id: "aurora", label: "Aurora", document: auroraPalette },
    { id: "rosewater", label: "Rosewater", document: rosewaterPalette },
  ],
};

export const demoPalettes: Readonly<Record<string, ThemeDocument>> = {
  aurora: auroraPalette,
  bauhaus: bauhausPalette,
  botanical: botanicalPalette,
  catppuccin: catppuccinPalette,
  ceramic: ceramicPalette,
  eucalyptus: eucalyptusPalette,
  graphite: graphitePalette,
  nordic: nordicPalette,
  ochre: ochrePalette,
  risograph: risographPalette,
  rosewater: rosewaterPalette,
  terracotta: terracottaPalette,
};

export const demoSpacings: Readonly<Record<string, ThemeDocument>> = {
  compact: compactSpacing,
  spacious: spaciousSpacing,
};
