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
export function editToken(path: string[], value: string): void {
  try {
    setThemeText(
      setToken(
        themeText(),
        path,
        value,
        activeMode() === "dark" ? "dark" : "base",
      ),
    );
  } catch {
    return;
  }
}
