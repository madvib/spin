import { setDarkValue, setTokenValue } from "./theme";
import { activeMode, setThemeText, themeText } from "./store";

export function editToken(path: string[], value: string): void {
  try {
    const text = themeText();
    setThemeText(
      activeMode() === "dark"
        ? setDarkValue(text, path, value)
        : setTokenValue(text, path, value),
    );
  } catch {
    return;
  }
}
