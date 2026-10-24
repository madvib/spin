import type { ThemeDocument } from "@spinjs/theme";

/**
 * The overlay: theme names to the documents the studio is editing.
 *
 * A process-global cell, because the plugin and the preset are the same
 * process but not the same module graph. Vite bundles `vite.config.ts`
 * and inlines its own copy of this module, while `@spinjs/api` resolves a
 * second copy through the import map; a module-scope `let` would give each
 * copy its own overlay, and an RPC write would never reach the generator.
 * State lives on `globalThis` so every copy shares one cell.
 */
interface OverlayCell {
  overlay: Record<string, ThemeDocument>;
  listeners: Set<() => void>;
  /** The disk documents, noted by whoever generates from them. */
  disk: Record<string, ThemeDocument>;
}

const CELL_KEY = "__spin_theme_overlay__";

function cell(): OverlayCell {
  const globals = globalThis as unknown as Record<
    string,
    OverlayCell | undefined
  >;
  return (globals[CELL_KEY] ??= {
    overlay: {},
    listeners: new Set(),
    disk: {},
  });
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
 * Note the disk documents, from whoever generates from them.
 *
 * The plugin calls this on every generate with the same documents it
 * passes the preset, so the cell always compares the overlay against what
 * "saved" currently means — including after a save rewrites disk.
 */
export function noteDiskDocuments(
  documents: Record<string, ThemeDocument>,
): void {
  cell().disk = documents;
}

/**
 * Refresh one noted document after a save rewrites it.
 *
 * The plugin re-notes everything on every generate, but no generate runs
 * on a save — without this, a save would leave the badge lit until the
 * next edit, which is the exact lie the badge exists to prevent.
 */
export function noteDiskDocument(name: string, text: string): void {
  try {
    cell().disk = {
      ...cell().disk,
      [name]: JSON.parse(text) as ThemeDocument,
    };
  } catch {
    // Unparseable text never reached disk as a document; leave the note.
  }
}

/**
 * The overlaid names whose documents differ from disk.
 *
 * Compared structurally, not by identity: the overlay holds a copy, so a
 * write followed by no edit still reads dirty until the comparison says
 * otherwise.
 */
export function overlayDirty(): string[] {
  const { overlay, disk } = cell();
  return Object.keys(overlay).filter((name) => {
    const onDisk = disk[name];
    if (onDisk === undefined) return true;
    return JSON.stringify(overlay[name]) !== JSON.stringify(onDisk);
  });
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
  // Per-theme merge, not replacement: the overlay holds the themes being
  // edited and disk holds the rest. A studio editing `acme` must not blank
  // the `default` the app beside it is rendering — the browser proved it
  // does when the overlay wins wholesale.
  if (!hasOverlay()) return documents;
  return { ...documents, ...overlayThemes() };
}
