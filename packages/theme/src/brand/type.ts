/**
 * Per-design-language type suggestions: the curated pairings of Step 4.
 *
 * Each design language ships its voices — the display and body faces and the
 * mono it reads code in — read out of the shipped theme files, never written
 * down beside them. A suggestion names the faces and the scale ratio over
 * the base ladder, plus the system-ui escape for the author who wants none
 * of it. The procedure applies one; this only suggests.
 */

import type { ThemeDocument } from "../pipeline/types.ts";
import { asRecord } from "../json.ts";
import { designLanguages } from "../languages/index.ts";

/** One curated pairing: the faces a design language suggests. */
export interface TypeSuggestion {
  /** The design language this pairing belongs to. */
  readonly language: string;
  /** The display face: headings, titles, the largest statements. */
  readonly display: string;
  /** The body face: prose, UI, everything else. */
  readonly body: string;
  /** The mono face: code, identifiers, tabular figures. */
  readonly mono: string;
  /** The scale ratio over the base ladder. Editorial's ladder runs larger. */
  readonly ratio: number;
}

function faceOf(document: ThemeDocument, path: string): string | undefined {
  let node: unknown = document;
  for (const segment of path.split(".")) {
    const record = asRecord(node);
    if (record === undefined) return undefined;
    node = record[segment];
  }
  const leaf = asRecord(node)?.["$value"];
  return typeof leaf === "string" ? leaf : undefined;
}

function displayOf(language: string, document: ThemeDocument): string {
  return faceOf(document, "font.family.heading") ?? faceOf(document, "font.family.sans") ?? "system-ui, sans-serif";
}

function bodyOf(document: ThemeDocument): string {
  return faceOf(document, "font.family.sans") ?? "system-ui, sans-serif";
}

function monoOf(document: ThemeDocument): string {
  return faceOf(document, "font.family.mono") ?? "ui-monospace, monospace";
}

/** The scale ratio the language's own ladder implies, against the base 1.5 step. */
function ratioOf(language: string): number {
  return language === "editorial" ? 1.333 : 1.25;
}

/**
 * The curated pairings, one per design language.
 *
 * Read out of the shipped themes — the display voice of each file, its body
 * face, its mono — so a theme file that gains a voice teaches the chooser
 * with it. The system-ui escape rides beside them: the author who wants no
 * voice names it.
 */
export function typeSuggestions(): readonly TypeSuggestion[] {
  return Object.entries(designLanguages).map(([language, document]) => ({
    language,
    display: displayOf(language, document),
    body: bodyOf(document),
    mono: monoOf(document),
    ratio: ratioOf(language),
  }));
}

/**
 * The faces one suggestion states, as the sparse `font.family.*` overrides
 * the brand owns: display, body, and mono leaves only.
 */
export function suggestionFaces(suggestion: TypeSuggestion): Record<string, { $value: string }> {
  return {
    sans: { $value: suggestion.body },
    heading: { $value: suggestion.display },
    body: { $value: suggestion.body },
    mono: { $value: suggestion.mono },
  };
}
