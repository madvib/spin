import type { ThemeDocument } from "@spin/theme";

/**
 * The overlay: theme names to the documents the studio is editing.
 *
 * A process-global cell, because the plugin and the preset are the same
 * process but not the same module graph. Vite bundles `vite.config.ts`
 * and inlines its own copy of this module, while `@spin/api` resolves a
 * second copy through the import map; a module-scope `let` would give each
 * copy its own overlay, and an RPC write would never reach the generator.
 * State lives on `globalThis` so every copy shares one cell.
 */
interface OverlayCell {
  overlay: Record<string, ThemeDocument>;
  listeners: Set<() => void>;
}

const CELL_KEY = "__spin_theme_overlay__";

function cell(): OverlayCell {
  const globals = globalThis as unknown as Record<
    string,
    OverlayCell | undefined
  >;
  return (globals[CELL_KEY] ??= { overlay: {}, listeners: new Set() });
}

/**
 * Who wants to know when the overlay moves.
 *
 * The plugin is the only listener that matters, and it wants to invalidate
 * the generated module so the app re-themes. The cell does not know vite
 * exists — it just announces, and the direction stays one way.
 */
export function onOverlayChange(listener: () => void): () => void {
  const listeners = cell().listeners;
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function announce(): void {
  for (const listener of cell().listeners) listener();
}

export function setOverlay(themes: Record<string, ThemeDocument>): void {
  // A copy, because the studio hands us a document it may keep mutating, and
  // an overlay that aliases its caller changes underneath the generator.
  cell().overlay = Object.fromEntries(
    Object.entries(themes).map(([name, document]) => [
      name,
      structuredClone(document),
    ]),
  );
  announce();
}

export function clearOverlay(): void {
  cell().overlay = {};
  announce();
}

/** The overlay as it stands, or an empty object when nothing is open. */
export function overlayThemes(): Record<string, ThemeDocument> {
  return Object.fromEntries(
    Object.entries(cell().overlay).map(([name, document]) => [
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
  return Object.keys(cell().overlay).length > 0;
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
