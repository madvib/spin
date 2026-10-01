export interface ThemeContext {
  theme?: unknown;
}

const themeCache = new WeakMap<object, Map<string, Map<string, string>>>();

function flattenSection(section: unknown): Map<string, string> {
  const out = new Map<string, string>();
  const visit = (node: unknown, prefix: string): void => {
    if (typeof node === "string" || typeof node === "number") {
      out.set(prefix, String(node));
      return;
    }
    if (typeof node === "object" && node !== null && !Array.isArray(node)) {
      for (const [key, value] of Object.entries(node)) {
        const name = String(key).toLowerCase();
        visit(value, prefix ? `${prefix}-${name}` : name);
      }
    }
  };
  visit(section, "");
  return out;
}

export function extendedTheme(
  ctx: ThemeContext | undefined,
  keys: string[],
  name: string,
): string | undefined {
  const theme = ctx?.theme;
  if (typeof theme !== "object" || theme === null) return undefined;
  let perTheme = themeCache.get(theme);
  if (!perTheme) {
    perTheme = new Map();
    themeCache.set(theme, perTheme);
  }
  for (const key of keys) {
    let flat = perTheme.get(key);
    if (!flat) {
      flat = flattenSection((theme as Record<string, unknown>)[key]);
      perTheme.set(key, flat);
    }
    const value = flat.get(name);
    if (value !== undefined) return value;
  }
  return undefined;
}
