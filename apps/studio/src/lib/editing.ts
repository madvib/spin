import {
  applyEdits,
  createToken as insertToken,
  deleteToken as dropToken,
} from "./theme";
import type { EditSlot } from "./theme";
import { activeMode, noteRefusal, setThemeText, themeText } from "./store";
import type { SpinFontDeclaration } from "./fonts";
/** One edit, as the controls spell it: a DTCG path and the value to write. */
export interface TokenEdit {
  path: string[];
  value: string;
}

/**
 * Apply token edits to the working document, as one edit.
 *
 * The mode picks where the values land: the tokens' own `$value`, or their
 * `$modes.dark`. A caller that knows which slot it is writing — a page that
 * shows both slots at once, each with its own control — says so; a caller
 * that follows the preview follows the active mode. Validation is a
 * property of the control that produces the value — a colour field emits
 * colours, a scale emits steps — so a bad edit cannot reach the document in
 * the first place. The batch is all or nothing, because a group scaled by
 * one factor that half-landed is a group whose ratios the factor never set.
 *
 * The paths are handed to the gate with the edit: the gate refuses a value
 * that would not build, and it says so about the TOKEN the value belongs
 * to, so the refusal can be read where the value is shown.
 */
export function editTokens(
  edits: readonly TokenEdit[],
  mode?: EditSlot,
): boolean {
  const slot = mode ?? (activeMode() === "dark" ? "dark" : "base");
  const next = (() => {
    try {
      return applyEdits(themeText(), edits, slot);
    } catch (err) {
      noteRefusal(err instanceof Error ? err.message : String(err));
      return undefined;
    }
  })();
  if (next === undefined) return false;
  // The gate refuses a document the theme's own rules fail and says why;
  // the answer is whether the DOCUMENT moved, which is what the control
  // needs in order to revert.
  const before = themeText();
  const wrote = setThemeText(next, edits.map((edit) => edit.path.join(".")));
    return themeText() !== before;
}

/** Apply one token edit, into `mode`'s slot when the caller names one. */
export function editToken(
  path: string[],
  value: string,
  mode?: EditSlot,
): boolean {
  return editTokens([{ path, value }], mode);
}

/**
 * Create a token at a path the document does not have yet, with its type.
 *
 * The one write that may ADD to the document rather than move something in
 * it: a component token belongs to the manifest's vocabulary, and an author
 * meets it on a component page whose theme has never had to spell
 * `button.weight`. The scaffold is the manifest's own value, so the token is
 * spendable the moment it lands.
 *
 * A refusal — the path exists, a segment stands where a token stands — is
 * a false, the same word `editTokens` gives a document that will not take
 * the edit; the document never moves on a failed creation.
 */
export function createToken(
  path: string[],
  type: string,
  value: string,
): boolean {
  const before = themeText();
  let next: string;
  try {
    next = insertToken(before, path, type, value);
  } catch (err) {
    noteRefusal(err instanceof Error ? err.message : String(err));
    return false;
  }
  // The token is named with the edit, so a value that would not build is
  // refused against the token it would have landed in.
  setThemeText(next, [path.join(".")]);
  return themeText() !== before;
}

/**
 * Create the token, or edit it if it already exists.
 *
 * The compact form a mint-on-choice needs: the element table writes leaves
 * by setting a field, without knowing whether the theme has ever carried
 * that element before. A straight edit fails on a missing path, which is the
 * expected and silent word; a straight create fails on an existing path,
 * also expected. Doing one then the other lands exactly one edit or a
 * legibility refusal, never both, and never a clobber.
 */
export function upsertToken(
  path: string[],
  type: string,
  value: string,
  mode?: EditSlot,
): boolean {
  const before = themeText();
  if (pathExists(before, path)) {
    if (editToken(path, value, mode)) return true;
    return false;
  }
  return createToken(path, type, value);
}

/**
 * Remove a token from the working document so the element or component falls
 * back to its ladder or shared scale.
 */
export function removeToken(path: readonly string[]): boolean {
  const before = themeText();
  if (!pathExists(before, path)) return false;
  let next: string;
  try {
    next = dropToken(before, path);
  } catch (err) {
    noteRefusal(err instanceof Error ? err.message : String(err));
    return false;
  }
  setThemeText(next, [path.join(".")]);
  return themeText() !== before;
}

function pathExists(text: string, path: readonly string[]): boolean {
  let node: unknown = JSON.parse(text);
  for (const segment of path) {
    if (typeof node !== "object" || node === null) return false;
    node = (node as Record<string, unknown>)[segment];
  }
  return node !== undefined;
}

export function editFontFamily(
  path: readonly string[],
  stack: string,
  font?: SpinFontDeclaration,
): boolean {
  const slot = activeMode() === "dark" ? "dark" : "base";
  let next: string;
  try {
    next = applyEdits(themeText(), [{ path: [...path], value: stack }], slot);
    if (font !== undefined) {
      const doc = JSON.parse(next) as Record<string, unknown>;
      const ext = ((doc["$extensions"] ?? {}) as Record<string, unknown>);
      const spin = ((ext["spin"] ?? {}) as Record<string, unknown>);
      const existing = Array.isArray(spin["fonts"])
        ? (spin["fonts"] as Record<string, unknown>[])
        : [];
      const filtered = existing.filter((entry) => entry["family"] !== font.family);
      spin["fonts"] = [...filtered, { ...font }];
      ext["spin"] = spin;
      doc["$extensions"] = ext;
      next = `${JSON.stringify(doc, null, 2)}\n`;
    }
  } catch (err) {
    noteRefusal(err instanceof Error ? err.message : String(err));
    return false;
  }
  const before = themeText();
  setThemeText(next, [path.join(".")]);
  return themeText() !== before;
}
