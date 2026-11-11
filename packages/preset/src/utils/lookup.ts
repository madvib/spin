import type { Rule, RuleContext } from "@unocss/core";
import type { ThemeRef } from "./theme-ref.ts";
import { themeKey } from "./theme-ref.ts";
import type { Theme, ThemeTokenPath } from "@spinjs/theme/theme-types";

/** A rule over the spin theme: `ctx.theme` is the nested typed `Theme`. */
export type SpinRule = Rule<Theme>;

export interface ThemeContext extends Pick<RuleContext<Theme>, "theme" | "symbols"> {}

/**
 * The theme map out of the rule context.
 *
 * Values are the references `themeRef` built, so a rule reads one and returns
 * it — there is no path to join and no name to spell. A name the theme does
 * not carry is simply absent, which is what makes an undeclared token emit
 * nothing rather than fall back.
 */
export function themeOf(ctx: ThemeContext | undefined): ThemeRef | undefined {
  const theme = ctx?.theme;
  return typeof theme === "object" && theme !== null
    ? theme as unknown as ThemeRef
    : undefined;
}

/**
 * A canonical token, by its dotted path.
 *
 * The parameter is the generated path union, so a read spelled wrong is a
 * compile error rather than a declaration that silently never applies. A
 * path the theme does not declare — a scale step a minimal theme omits — is
 * undefined by design, and the caller states its own fallback.
 *
 * A theme names its tokens under the canonical paths and nowhere else: there
 * is no second spelling a reader has to know about. The per-element
 * typography paths are gone — elements read named styles.
 */
export function token(
  ctx: ThemeContext | undefined,
  path: ThemeTokenPath,
): string | undefined {
  return themeOf(ctx)?.[themeKey(path)];
}

/**
 * A token a class name carries, where the name is data.
 *
 * The utility families resolve the suffix the author typed, so this lookup is
 * dynamic by nature: `named(ctx, "spacing", "4")` is `--spacing-4`, and the
 * family is the flat name prefix — the words the class itself is made of.
 */
export function named(
  ctx: ThemeContext | undefined,
  family: string,
  name: string,
): string | undefined {
  return themeOf(ctx)?.[`${family}-${name}`];
}

/**
 * The names one family carries: every flat key under `family-`, stripped back
 * to the name a class would write. For autocomplete templates.
 */
export function namesIn(theme: ThemeRef, family: string): string[] {
  const prefix = `${family}-`;
  return Object.keys(theme)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));
}

/**
 * The named type styles the theme declares.
 *
 * A style is five leaves under one name — `font-style-body-family` through
 * `font-style-body-leading` — and the utility is the name alone, so the
 * leaves fold back to the name. For autocomplete templates and the catalog.
 */
export function styleNames(theme: ThemeRef): string[] {
  const names = new Set<string>();
  for (const key of Object.keys(theme)) {
    if (!key.startsWith("font-style-")) continue;
    const rest = key.slice("font-style-".length);
    const dash = rest.lastIndexOf("-");
    if (dash > 0) names.add(rest.slice(0, dash));
  }
  return [...names];
}
