import baseElements from "./base/elements.json" with { type: "json" };
import basePrimitives from "./base/primitives.json" with { type: "json" };
import baseReference from "./base/reference.json" with { type: "json" };
import baseRoles from "./base/roles.json" with { type: "json" };
import { mergeThemeDocuments } from "./merge.ts";
import type { ThemeDocument } from "./pipeline/types.ts";

/** The shared foundation every starter layers over. */
export const baseDocument: ThemeDocument = mergeThemeDocuments(
  mergeThemeDocuments(
    mergeThemeDocuments(
      baseRoles as ThemeDocument,
      baseReference as ThemeDocument,
    ),
    baseElements as ThemeDocument,
  ),
  basePrimitives as ThemeDocument,
);
