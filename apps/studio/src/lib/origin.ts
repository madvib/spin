/**
 * Which layer states a leaf: the brand's files, or the starter under them.
 *
 * Composition merges every layer into one document and keeps no provenance,
 * so the studio answers origin by walking the layers top-down itself: the
 * brand's component files first, then its elements layer, then its tokens
 * layer, then the starter the tokens layer extends. The first layer that
 * states the leaf's path owns it. A composite's tuple children inherit the
 * composite's origin — the expansion is the parse's, not a layer's.
 */

import { starterThemes } from "@spinjs/theme/themes";

/** Where a leaf's value comes from. */
export type LeafOrigin =
  | "starter"
  | "tokens"
  | "elements"
  | "component"
  | "facet"
  | "unknown";

/** The layers a brand report carries, keyed by relative file. */
export interface OriginLayers {
  readonly starter: string;
  readonly tokens: Record<string, unknown> | undefined;
  readonly elements: Record<string, unknown> | undefined;
  readonly components: ReadonlyArray<{
    readonly file: string;
    readonly doc: Record<string, unknown>;
  }>;
}

/**
 * The walk's layers from a brand report.
 *
 * Component files are the `primitives/*.json` keys; anything else that is
 * not the tokens or elements layer is ignored, because the walk owns its
 * layer list and a file it does not know is not a layer.
 */
export function layersOf(
  layers: Record<string, unknown>,
  designLanguage: string | undefined,
): OriginLayers {
  const docOf = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const components: { file: string; doc: Record<string, unknown> }[] = [];
  for (const [file, value] of Object.entries(layers)) {
    if (!file.startsWith("primitives/") || !file.endsWith(".json")) continue;
    const doc = docOf(value);
    if (doc !== undefined) components.push({ file, doc });
  }
  return {
    starter: designLanguage ?? "minimal",
    tokens: docOf(layers["tokens.json"]),
    elements: docOf(layers["elements.json"]),
    components,
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

/** The starter document behind a brand, by its `$extends` name. */
function starterDoc(name: string): Record<string, unknown> | undefined {
  const found: unknown = starterThemes[name];
  if (found === undefined || typeof found !== "object" || found === null) return undefined;
  return found as Record<string, unknown>;
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
    for (const component of layers.components) {
      if (states(component.doc, prefix)) return "component";
    }
    if (states(layers.elements, prefix)) return "elements";
    if (states(layers.tokens, prefix)) return "tokens";
    if (states(starterDoc(layers.starter), prefix)) return "starter";
  }
  return "unknown";
}

/** The file an origin names, for the chip's tooltip. */
export function originFile(
  origin: LeafOrigin,
  path: readonly string[],
  layers: OriginLayers,
): string {
  if (origin === "starter") return `${layers.starter}.json`;
  if (origin === "tokens") return "tokens.json";
  if (origin === "elements") return "elements.json";
  if (origin === "component") {
    for (let end = path.length; end > 0; end--) {
      const prefix = path.slice(0, end);
      for (const component of layers.components) {
        if (states(component.doc, prefix)) return component.file;
      }
    }
    return "primitives/";
  }
  return "the theme";
}

/** The chip's one word for an origin. */
export function originLabel(origin: LeafOrigin): string {
  if (origin === "starter") return "starter";
  if (origin === "tokens" || origin === "elements") return "brand";
  if (origin === "component") return "component";
  if (origin === "facet") return "facet";
  return "starter";
}
