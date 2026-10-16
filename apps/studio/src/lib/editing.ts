import { applyEdits, createToken as insertToken } from "./theme";
import { activeMode, setThemeText, themeText } from "./store";

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
 */
export function editTokens(
  edits: readonly TokenEdit[],
  mode?: "base" | "dark",
): boolean {
  const slot = mode ?? (activeMode() === "dark" ? "dark" : "base");
  const next = (() => {
    try {
      return applyEdits(themeText(), edits, slot);
    } catch {
      return undefined;
    }
  })();
  if (next === undefined) return false;
  // The gate refuses a document the theme's own legibility rule fails and
  // says why; the answer is whether the DOCUMENT moved, which is what the
  // control needs in order to revert.
  const before = themeText();
  setThemeText(next);
  return themeText() !== before;
}

/** Apply one token edit, into `mode`'s slot when the caller names one. */
export function editToken(
  path: string[],
  value: string,
  mode?: "base" | "dark",
): boolean {
  return editTokens([{ path, value }], mode);
}

/**
 * Create a token at a path the document does not have yet, with its type.
 *
 * The one write that may ADD to the document rather than move something in
 * it: a component's character token belongs to the manifest's vocabulary,
 * and an author meets it on a component page whose theme has never had to
 * spell `button.weight`. The scaffold is the manifest's own value, so the
 * token is spendable the moment it lands.
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
  } catch {
    return false;
  }
  setThemeText(next);
  return themeText() !== before;
}
