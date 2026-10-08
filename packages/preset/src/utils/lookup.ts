import type { ThemeRef, ThemeRefGroup } from "@spin/theme";

export interface ThemeContext {
  theme?: unknown;
}

/**
 * Our groups out of the theme, as `{name: reference}`.
 *
 * The values are already the references `themeRef` built, so a rule reads one
 * and returns it — there is no path to join and no name to spell. A group the
 * theme does not carry is simply absent, which is what makes an unknown token
 * emit nothing rather than fall back.
 */
export function themeOf(ctx: ThemeContext | undefined): ThemeRef | undefined {
  const theme = ctx?.theme;
  return typeof theme === "object" && theme !== null
    ? theme as ThemeRef
    : undefined;
}

/** One group's references, or an empty map so a rule needs no guard. */
export function groupOf(
  ctx: ThemeContext | undefined,
  group: string,
): ThemeRefGroup {
  const section = themeOf(ctx)?.[group];
  return typeof section === "object" && section !== null
    ? section as ThemeRefGroup
    : {};
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

/**
 * A token from the theme, by group and name.
 *
 * The direct lookup first — `themeOf(ctx)?.[group]?.[name]` — then the
 * extended one, which reads the theme's `extend` block. The extra keys are
 * the alternate group names the extended lookup tries, so a theme that
 * declares its radii under `borderRadius` rather than `radius` is found.
 */
export function tokenOf(
  ctx: ThemeContext | undefined,
  group: string,
  name: string,
  ...extraKeys: string[]
): string | undefined {
  const direct = themeOf(ctx)?.[group]?.[name];
  if (direct !== undefined) return direct;
  return extendedTheme(ctx, [group, ...extraKeys], name);
}
