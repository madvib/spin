import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { mergeThemeDocuments } from "../extends.ts";
import { demoPalettes, demoSpacings, languagePalettes } from "../facets/index.ts";
import { type DesignLanguageName, designLanguages } from "../languages/index.ts";
import type { ThemeDocument } from "../pipeline/types.ts";
import { themeGates } from "./battery.ts";
import { validatePaletteFacet, validateSpacingFacet } from "./validate-theme.ts";
const SPACING_AXIS: Readonly<Record<string, ThemeDocument | undefined>> = {
  none: undefined,
  ...demoSpacings,
};

for (const [paletteName, paletteDoc] of Object.entries(demoPalettes)) {
  test(`palette facet ${paletteName} passes standalone facet validation`, () => {
    const report = validatePaletteFacet(paletteDoc);
    deepStrictEqual(report.issues, []);
  });
}

for (const [spacingName, spacingDoc] of Object.entries(demoSpacings)) {
  test(`spacing facet ${spacingName} passes standalone facet validation`, () => {
    const report = validateSpacingFacet(spacingDoc);
    deepStrictEqual(report.issues, []);
  });
}

for (const [languageName, languageDoc] of Object.entries(designLanguages) as [DesignLanguageName, ThemeDocument][]) {
  const paletteAxis: Readonly<Record<string, ThemeDocument | undefined>> = {
    none: undefined,
    ...Object.fromEntries(languagePalettes[languageName].map((entry) => [entry.id, entry.document])),
  };
  for (const [paletteName, paletteDoc] of Object.entries(paletteAxis)) {
    for (const [spacingName, spacingDoc] of Object.entries(SPACING_AXIS)) {
      if (paletteDoc === undefined && spacingDoc === undefined) continue;
      test(`${languageName} × palette:${paletteName} × spacing:${spacingName} passes every gate in light and dark`, () => {
        let composed = languageDoc;
        if (paletteDoc !== undefined) composed = mergeThemeDocuments(composed, paletteDoc);
        if (spacingDoc !== undefined) composed = mergeThemeDocuments(composed, spacingDoc);
        const report = themeGates(JSON.stringify(composed), { modes: ["dark"] });
        const issues = report.gates.flatMap((gate) => gate.issues);
        deepStrictEqual(issues, []);
      });
    }
  }
}
