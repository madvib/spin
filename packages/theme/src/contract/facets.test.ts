import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { mergeThemeDocuments } from "../extends.ts";
import { themeGates } from "./battery.ts";
import {
  catppuccinPalette,
  compactSpacing,
  starterThemes,
} from "../themes/index.ts";

// A facet worn over a starter reads as the facet merged over it: at runtime
// the facet's `[data-palette]` / `[data-spacing]` block wins ties at equal
// specificity, and on the token side that is `mergeThemeDocuments` — the same
// helper the facet validators judge with. No single daemon/studio composer
// exists to call (composition is the cascade), so it stays test-local here.
const FACETS = { catppuccin: catppuccinPalette, compact: compactSpacing } as const;

for (const [starterName, starter] of Object.entries(starterThemes)) {
  for (const [facetName, facet] of Object.entries(FACETS)) {
    test(`${starterName} + ${facetName} holds every legibility floor in base and dark`, () => {
      const composed = mergeThemeDocuments(starter, facet);
      // The served-dark claim judges the dark rendering too; the base is
      // always judged. The battery folds the state pairs into legibility.
      const report = themeGates(JSON.stringify(composed), { modes: ["dark"] });
      deepStrictEqual(
        report.gates.find((gate) => gate.gate === "legibility")?.issues,
        [],
      );
    });
  }
}
