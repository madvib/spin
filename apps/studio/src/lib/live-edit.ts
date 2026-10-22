/**
 * The live edit's arithmetic.
 *
 * Two facts a control needs while an author is dragging it:
 *
 * - **How far along the value is.** The browser knows it — it is the value
 *   the input holds — and CSS cannot read it, so the sheet cannot paint the
 *   fill that says it. The control asks for the share of the travel and
 *   hands it to the sheet as a custom property.
 * - **What the theme declares behind the value being edited.** The document
 *   the studio edits is the author's; the project holds the document the
 *   theme declares, and a reset puts the token back to that.
 *
 * Pure, so both can be tested without a window: a gesture is a gesture
 * whether or not a browser is watching it.
 */

import { parseTokens, valuesInMode } from "@spin/theme";

/**
 * The share of a track's travel a value has covered, as a percentage.
 *
 * The browser maps the track's bounds onto the travel between the two ends
 * of the groove, so the share is the value's place between the bounds — and
 * the fill the groove paints stops where the thumb is.
 *
 * A track with no travel has no share: the answer is no fill, not a
 * division by nothing. A value outside the bounds is clamped to it, because
 * a fill that runs past the end of the groove is a fill that says something
 * the value does not.
 */
export function rangeProgress(
  value: number,
  min: number,
  max: number,
): string {
  if (!Number.isFinite(value)) return "0%";
  if (!Number.isFinite(min) || !Number.isFinite(max)) return "0%";
  const span = max - min;
  if (span <= 0) return "0%";
  const share = (value - min) / span;
  const clamped = Math.min(1, Math.max(0, share));
  return `${Math.round(clamped * 10_000) / 100}%`;
}

/**
 * The value a document declares for a token, in one mode.
 *
 * The document is read as it stands, so a reset has something to put back.
 * A mode is part of the question: a token may declare a different value in
 * dark, and the value the reset puts back is the one the author is looking
 * at.
 *
 * A document that cannot be read declares nothing: the answer is absent,
 * and a reset with nothing to put back is a reset that stays inert.
 */
export function declaredValue(
  text: string,
  path: string,
  mode: string,
): string | undefined {
  const parsed = parseTokens(text);
  if (!parsed.ok) return undefined;
  const value = valuesInMode(parsed.tree, mode).get(path);
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : String(value);
}

/**
 * The token a control edits, named by the control.
 *
 * A control is given the token's path as its label, and the row that holds
 * it names the control after the path as well — `token-icon.md` for
 * `icon.md`. Either names the token; a control named for nothing says
 * nothing, and answers that it edits no token at all.
 */
export function tokenPath(
  id: string | undefined,
  label: string | undefined,
): string | undefined {
  if (label !== undefined && label !== "") return label;
  if (id === undefined) return undefined;
  const prefix = "token-";
  return id.startsWith(prefix) ? id.slice(prefix.length) : undefined;
}
