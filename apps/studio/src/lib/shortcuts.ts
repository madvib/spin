/**
 * The studio's keyboard verbs.
 *
 * The top bar carries undo, redo and save, and a toolbar is a keyboard
 * surface too: an author who is editing with a keyboard should not have to
 * leave the document, find the mouse and press a glyph to undo a value. The
 * bindings are the platform's own — `Mod+Z`, `Mod+Shift+Z` (and `Mod+Y`, for
 * the Windows muscle memory), `Mod+S` — so the studio adds nothing to learn.
 *
 * The rules are about SCOPE, not about which keys:
 *
 * - a field owns its own undo. `Mod+Z` in a text box rewinds what was typed
 *   there, which is what the author is looking at; the document's history is
 *   the top bar's job, and a studio that stole the field's undo would make
 *   typing into a token dangerous;
 * - a dialog is a mode. While a `<dialog>` is open the page behind it is not
 *   the work — its verbs do not reach through;
 * - save is the one verb that reaches into a field. `Mod+S` has no meaning
 *   inside a text box and the browser's "save page" is never what an author
 *   means, so it is prevented everywhere and saves the document.
 *
 * Nothing here judges whether the document can move: `undo`, `redo` and
 * `saveThemeToDisk` already answer that, and a second answer would drift.
 */

import {
  activeName,
  canRedo,
  canUndo,
  isDirty,
  redo,
  saveThemeToDisk,
  undo,
} from "./store.ts";

/**
 * Whether the event's target is a place that keeps its own history.
 *
 * A field, a text area, a select and a contenteditable all have an undo of
 * their own, and the browser gives it to the reader who is typing. The
 * document's history is a different history.
 */
function ownsUndo(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Install the bindings, and hand back the function that takes them off.
 *
 * One listener on the window, because the studio is one document: a shortcut
 * is a fact about the tool rather than about a page, and a page that
 * unmounts must not take the author's undo with it.
 */
export function installShortcuts(): () => void {
  const onKey = (event: KeyboardEvent): void => {
    // `Mod` is Command on a Mac and Control elsewhere, which is what the
    // platform's own bindings do. Alt is a different chord entirely.
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    // A dialog is a mode: the page behind it is not the work.
    if (document.querySelector("dialog[open]") !== null) return;

    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      const name = activeName();
      if (isDirty(name)) void saveThemeToDisk(name);
      return;
    }

    if (ownsUndo(event.target)) return;

    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      if (canUndo()) undo();
      return;
    }
    if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault();
      if (canRedo()) redo();
    }
  };

  globalThis.addEventListener("keydown", onKey);
  return () => globalThis.removeEventListener("keydown", onKey);
}
