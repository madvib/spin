import { setToken } from "./theme";
import { activeMode, setThemeText, themeText } from "./store";

/**
 * Apply one token edit to the working document.
 *
 * The mode picks where the value lands: the token's own `$value`, or its
 * `$modes.dark`. Validation is a property of the control that produces the
 * value — a color field emits colors, a spacing field emits steps — so this
 * never has to reject anything, and a bad edit cannot reach the document in
 * the first place.
 */
export function editToken(path: string[], value: string): boolean {
  const next = (() => {
    try {
      return setToken(
        themeText(),
        path,
        value,
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
