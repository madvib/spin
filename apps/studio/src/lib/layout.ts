/**
 * Layout shortcuts, dogfooded here rather than in the preset.
 *
 * These are composition decisions every page of this app makes: stack things
 * vertically with a gap, put things beside each other, hold a control rail
 * beside a surface. Written out each time, they are `flex flex-col gap-4` and
 * `flex gap-4` and so on — repeated in eight files, and the repetition is why
 * the app looks generic.
 *
 * They are NOT primitives and NOT tokens. A token is a value; a primitive
 * carries base on a semantic tag. A shortcut consumes both and commits to a
 * composition, which is a third thing: quality of life that keeps one page's
 * spacing from drifting from the next one's.
 *
 * So they live here, in the studio's own stylesheet, until the composition is
 * proven. Promotion to the preset means the theme owns the gap — a theme that
 * prefers roomier sections sets it once — and that is a product decision with
 * a name on it forever, not something to fold into a layout fix.
 */

/**
 * The shortcuts, as utilities this app's scanner can see.
 *
 * Names are written out rather than interpolated for the reason the codebase
 * already documents: a class built at runtime never reaches the scanner, so
 * it styles nothing and looks like it worked.
 */
export const SHORTCUT_STYLESHEET = `
.stack { display: flex; flex-direction: column; gap: var(--spacing-4); }
.stack-sm { display: flex; flex-direction: column; gap: var(--spacing-2); }
.stack-lg { display: flex; flex-direction: column; gap: var(--spacing-8); }
.row { display: flex; align-items: center; gap: var(--spacing-4); }
.row-sm { display: flex; align-items: center; gap: var(--spacing-2); }
.split { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-4); }
.panel {
  background-color: var(--surface-raised, transparent);
  border: var(--border-width, 1px) solid var(--border, transparent);
  border-radius: var(--radius-md, 0);
  padding: var(--spacing-6, var(--spacing-4));
}
`;

/** Injects the shortcuts once, at app start. */
export function injectShortcuts(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("spin-studio-shortcuts")) return;
  const style = document.createElement("style");
  style.id = "spin-studio-shortcuts";
  style.textContent = SHORTCUT_STYLESHEET;
  document.head.appendChild(style);
}
