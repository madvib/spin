/**
 * Which layer states a leaf: the brand's files, or the language under them.
 *
 * Composition merges every layer into one document and keeps no provenance,
 * so the studio answers origin by walking the layers top-down itself: the
 * brand's tokens first, then the global reference, then the design language
 * the tokens layer extends. The first layer that states the leaf's path owns
 * it. A composite's tuple children inherit the composite's origin — the
 * expansion is the parse's, not a layer's.
 */

import { designLanguages, isDesignLanguage } from "@spinjs/theme";

/** Where a leaf's value comes from. */
export type LeafOrigin =
  | "language"
  | "tokens"
  | "reference"
  | "facet"
  | "unknown";

/** The layers a brand report carries, keyed by relative file. */
export interface OriginLayers {
  readonly language: string;
  readonly tokens: Record<string, unknown> | undefined;
  readonly reference: Record<string, unknown> | undefined;
}

/**
 * The walk's layers from a brand report.
 *
 * The tokens layer and the global reference; anything else the report
 * carries is ignored, because the walk owns its layer list and a file it
 * does not know is not a layer.
 */
export function layersOf(
  layers: Record<string, unknown>,
  designLanguage: string | undefined,
): OriginLayers {
  const docOf = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  return {
    language: designLanguage ?? "minimal",
    tokens: docOf(layers["tokens.json"]),
    reference: docOf(layers["../reference.json"]),
  };
}
/** Whether a document states a dotted path. */
function states(doc: Record<string, unknown> | undefined, path: readonly string[]): boolean {
  if (doc === undefined) return false;
  let node: unknown = doc;
  for (const segment of path) {
    if (typeof node !== "object" || node === null) return false;
    node = (node as Record<string, unknown>)[segment];
    if (node === undefined) return false;
  }
  return true;
}

/** The design language document behind a brand, by its `$extends` name. */
function languageDoc(name: string): Record<string, unknown> | undefined {
  if (!isDesignLanguage(name)) return undefined;
  return designLanguages[name] as Record<string, unknown>;
}

/**
 * Which layer states a leaf.
 *
 * Tuple children (`font.style.body.size`) inherit their composite's origin:
 * the walk climbs to the longest stated prefix, so an expansion the parse
 * invented answers with the composite's layer rather than no layer.
 */
export function leafOrigin(path: readonly string[], layers: OriginLayers): LeafOrigin {
  for (let end = path.length; end > 0; end--) {
    const prefix = path.slice(0, end);
    if (states(layers.tokens, prefix)) return "tokens";
    if (states(layers.reference, prefix)) return "reference";
    if (states(languageDoc(layers.language), prefix)) return "language";
  }
  return "unknown";
}

/** The file an origin names, for the chip's tooltip. */
export function originFile(
  origin: LeafOrigin,
  path: readonly string[],
  layers: OriginLayers,
): string {
  if (origin === "language") return `${layers.language}.json`;
  if (origin === "tokens") return "tokens.json";
  if (origin === "reference") return "../reference.json";
  return "the theme";
}

/** The chip's one word for an origin. */
export function originLabel(origin: LeafOrigin): string {
  if (origin === "language") return "language";
  if (origin === "tokens" || origin === "reference") return "brand";
  if (origin === "facet") return "facet";
  return "language";
}
