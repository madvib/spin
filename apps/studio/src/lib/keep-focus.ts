/**
 * Keep the author where they were across a commit.
 *
 * A commit moves the document, and the token tables are drawn from it: the
 * rows are rebuilt with the new values, so the very control the author is
 * holding is a NEW element a moment after they release it. Focus goes with
 * the old element, and a reader who pressed Enter in a field — or released a
 * track and wanted one more nudge with the arrow keys — is left at the top of
 * the page.
 *
 * So the studio remembers the control's id and the selection the author had
 * in it, and puts them back when the new row arrives. The id is the token's
 * own path (every control has one), which is the one thing about the control
 * that survives the re-render.
 *
 * A control with no id is left alone: there is no way to know which new
 * element was which, and guessing would put focus somewhere the author never
 * was. Add an id to a control that must keep focus; do not guess here.
 */

/** Whether an element carries a text selection worth restoring. */
function selectable(
  element: HTMLElement,
): element is HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return [
    "text",
    "search",
    "url",
    "tel",
    "password",
    "email",
    "number",
  ].includes(element.type);
}

/**
 * Remember where the author is, and put them back after the update.
 *
 * Call BEFORE the document moves. The capture is synchronous and the restore
 * is a microtask, so it lands after Solid has rebuilt the row and before the
 * next paint.
 */
export function keepFocus(): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active.id === "") return;
  const id = active.id;
  const selection = selectable(active)
    ? [active.selectionStart, active.selectionEnd] as const
    : undefined;
  queueMicrotask(() => {
    const next = document.getElementById(id);
    if (next === null || next === active) return;
    next.focus({ preventScroll: true });
    if (
      selection !== undefined && selection[0] !== null &&
      selection[1] !== null &&
      (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement)
    ) {
      try {
        next.setSelectionRange(selection[0], selection[1]);
      } catch {
        // A control that does not take a selection (a range, a colour):
        // focus is the whole of what it can keep.
      }
    }
  });
}
