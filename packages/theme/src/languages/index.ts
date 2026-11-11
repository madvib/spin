/** Shipped design languages layered over the base reference contract. */

import { baseDocument } from "../base-document.ts";
import { themeGroups } from "../contract/groups.ts";
import { expandExtends } from "../extends.ts";
import type { ThemeDocument } from "../pipeline/types.ts";
import editorial from "./editorial.json" with { type: "json" };
import glassmorphic from "./glassmorphic.json" with { type: "json" };
import material from "./material.json" with { type: "json" };
import minimal from "./minimal.json" with { type: "json" };
import neobrutalist from "./neobrutalist.json" with { type: "json" };
import neumorphic from "./neumorphic.json" with { type: "json" };

export { baseDocument };

function language(doc: unknown): ThemeDocument {
  return expandExtends(doc as ThemeDocument, { base: baseDocument });
}

export const minimalLanguage = language(minimal);
export const neobrutalistLanguage = language(neobrutalist);
export const materialLanguage = language(material);
export const editorialLanguage = language(editorial);
export const neumorphicLanguage = language(neumorphic);
export const glassmorphicLanguage = language(glassmorphic);

export type DesignLanguageName =
  | "minimal"
  | "editorial"
  | "material"
  | "neobrutalist"
  | "neumorphic"
  | "glassmorphic";

export const designLanguages: Record<DesignLanguageName, ThemeDocument> = {
  minimal: minimalLanguage,
  material: materialLanguage,
  neobrutalist: neobrutalistLanguage,
  neumorphic: neumorphicLanguage,
  editorial: editorialLanguage,
  glassmorphic: glassmorphicLanguage,
};

export function isDesignLanguage(name: string): name is DesignLanguageName {
  return Object.hasOwn(designLanguages, name);
}

export function designLanguageGroups(): readonly string[] {
  return themeGroups(Object.values(designLanguages));
}
