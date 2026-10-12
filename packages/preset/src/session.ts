import type { ThemeDocument } from "@spin/theme";

/**
 * The overlay: theme names to the documents the studio is editing.
 *
 * A module-scope cell because the plugin and the preset are the same
 * package and the same process. That is the whole transport — no sockets,
 * no RPC between them, no config line. The plugin populates it from disk
 * for a build and from the studio's live writes for a dev server, and the
 * preset reads it at generate time. One source at generate time, and the
 * source is whichever one was written last.
 */
let overlay: Record<string, ThemeDocument> = {};

export function setOverlay(themes: Record<string, ThemeDocument>): void {
  // A copy, because the studio hands us a document it may keep mutating, and
  // an overlay that aliases its caller changes underneath the generator.
  overlay = Object.fromEntries(
    Object.entries(themes).map((
      [name, document],
    ) => [name, structuredClone(document)]),
  );
}

export function clearOverlay(): void {
  overlay = {};
}

/** The overlay as it stands, or an empty object when nothing is open. */
export function overlayThemes(): Record<string, ThemeDocument> {
  return Object.fromEntries(
    Object.entries(overlay).map(([name, document]) => [
      name,
      structuredClone(document),
    ]),
  );
}

/**
 * True when the overlay is the live source rather than disk.
 *
 * A preset consulted while an overlay is set is editing; one consulted
 * with nothing set is building.
 */
export function hasOverlay(): boolean {
  return Object.keys(overlay).length > 0;
}

/**
 * The theme documents the preset should generate for.
 *
 * The overlay wins when present because the last write was a studio edit;
 * otherwise the caller's own documents, which for a build is disk.
 */
export function resolveThemes(
  documents: Record<string, ThemeDocument>,
): Record<string, ThemeDocument> {
  return hasOverlay() ? overlayThemes() : documents;
}
