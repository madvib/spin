/**
 * The fontsource catalogue, and the faces a theme can spend it on.
 *
 * Fontsource is the source of truth for "what fonts exist": one endpoint,
 * 2,103 families, each with the weights and subsets it ships. Two jobs here:
 *
 *   1. read the catalogue, so the studio's picker lists what is real rather
 *      than what somebody remembered, and
 *
 *   2. describe a face, so a theme's `font.family.heading` carries the family
 *      and the weights and subsets it spends — a `{ fontsource }` object rather
 *      than a stack string. The string is derived from it, because the stack is
 *      output and the object is the decision.
 *
 * A face whose token value is the legacy string is read as-is and reported as
 * a stack: themes in the wild still have one, and they keep working.
 */

/** The catalogue's own shape, as much of it as is used. */
export interface CatalogFont {
  readonly id: string;
  readonly family: string;
  readonly subsets: readonly string[];
  readonly weights: readonly number[];
  readonly styles: readonly string[];
  readonly variable: boolean;
  readonly category: string;
}

/** What a theme's family token holds once it names a fontsource family. */
export interface FontFace {
  /** The fontsource id — `fraunces`, `inter-variable` — the install target. */
  readonly fontsource: string;
  /** The weights to load. Variable families take a range, others a list. */
  readonly weights?: readonly number[];
  /** The subsets to load. Defaults to the family's own. */
  readonly subsets?: readonly string[];
}

/** A face token's value: a fontsource object, or a stack somebody wrote. */
export type FamilyValue = string | FontFace;

const CATALOG_URL = "https://api.fontsource.org/v1/fonts";

let cached: readonly CatalogFont[] | undefined;

/**
 * The whole catalogue, fetched once per session.
 *
 * A failure yields an empty list rather than a throw: a picker with nothing
 * in it is a recoverable state the UI can name, and an exception during
 * render is not.
 */
export async function loadCatalog(): Promise<readonly CatalogFont[]> {
  if (cached !== undefined) return cached;
  try {
    const response = await fetch(CATALOG_URL);
    if (!response.ok) return [];
    const list = await response.json() as CatalogFont[];
    cached = list;
    return cached;
  } catch {
    return [];
  }
}

/** The families whose id or name matches, most relevant first. */
export function searchCatalog(
  fonts: readonly CatalogFont[],
  query: string,
  limit = 40,
): readonly CatalogFont[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return fonts.slice(0, limit);
  return fonts
    .filter((font) =>
      font.id.toLowerCase().includes(needle) ||
      font.family.toLowerCase().includes(needle)
    )
    .slice(0, limit);
}

/** True when a token value names a fontsource family. */
export function isFace(value: unknown): value is FontFace {
  return typeof value === "object" && value !== null &&
    "fontsource" in value;
}

/** The npm package a face installs from. */
export function packageFor(face: FontFace): string {
  return face.fontsource.endsWith("-variable") ||
      face.fontsource.endsWith("-var")
    ? `@fontsource-variable/${face.fontsource}`
    : `@fontsource/${face.fontsource}`;
}

/** The CSS stack a face resolves to, for the value a theme stores. */
export function stackFor(
  face: FontFace,
  catalog: readonly CatalogFont[],
): string {
  const font = catalog.find((entry) => entry.id === face.fontsource);
  const family = font?.family ?? face.fontsource;
  const category = font?.category?.toLowerCase() ?? "";
  const fallback = category.includes("mono")
    ? "ui-monospace, monospace"
    : category === "serif" || category === "slab-serif"
    ? "Georgia, serif"
    : "ui-sans-serif, system-ui, sans-serif";
  return `"${family}", ${fallback}`;
}

export interface SpinFontDeclaration {
  readonly family: string;
  readonly src: string;
  readonly weight: string;
  readonly style: string;
  readonly display: string;
}

export function fontDeclarationFor(font: CatalogFont): SpinFontDeclaration {
  const url = font.variable
    ? `https://cdn.jsdelivr.net/fontsource/fonts/${font.id}:vf@latest/latin-wght-normal.woff2`
    : `https://cdn.jsdelivr.net/fontsource/fonts/${font.id}@latest/latin-${
      font.weights.includes(400) ? 400 : (font.weights[0] ?? 400)
    }-normal.woff2`;
  const minW = font.weights.length > 0 ? Math.min(...font.weights) : 400;
  const maxW = font.weights.length > 0 ? Math.max(...font.weights) : 700;
  const weight = font.variable && minW !== maxW
    ? `${minW} ${maxW}`
    : `${font.weights.includes(400) ? 400 : minW}`;
  return {
    family: font.family,
    src: `url(${url}) format("woff2")`,
    weight,
    style: "normal",
    display: "swap",
  };
}
const previewedDraftFonts = new Set<string>();

export function injectFontFaces(faces: readonly SpinFontDeclaration[]): void {
  if (typeof document === "undefined" || faces.length === 0) return;
  for (const face of faces) {
    if (previewedDraftFonts.has(face.family)) continue;
    previewedDraftFonts.add(face.family);
    const style = document.createElement("style");
    style.dataset.draftFont = face.family;
    style.textContent = `@font-face { font-family: "${face.family}"; src: ${face.src}; font-weight: ${face.weight}; font-style: ${face.style}; font-display: swap; }`;
    document.head.appendChild(style);
  }
}

export function facesOf(text: string): readonly SpinFontDeclaration[] {
  try {
    const doc = JSON.parse(text) as { $extensions?: { spin?: { fonts?: readonly SpinFontDeclaration[] } } };
    const fonts = doc.$extensions?.spin?.fonts;
    return Array.isArray(fonts) ? fonts : [];
  } catch {
    return [];
  }
}
