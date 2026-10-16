import { applyEdits } from "./theme";
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
 * `$modes.dark`. Validation is a property of the control that produces the
 * value — a colour field emits colours, a scale emits steps — so a bad edit
 * cannot reach the document in the first place. The batch is all or
 * nothing, because a group scaled by one factor that half-landed is a
 * group whose ratios the factor never set.
 */
export function editTokens(edits: readonly TokenEdit[]): boolean {
  const next = (() => {
    try {
      return applyEdits(
        themeText(),
        edits,
        activeMode() === "dark" ? "dark" : "base",
      );
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

/** Apply one token edit. */
export function editToken(path: string[], value: string): boolean {
  return editTokens([{ path, value }]);
}
