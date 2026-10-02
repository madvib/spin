import type { Rule } from "@unocss/core";
import { FRACTIONS, INSET_KEYWORDS } from "./vocabulary.ts";
import type { ThemeRef, ThemeRefGroup } from "@spin/theme";
import { extendedTheme, groupOf, type ThemeContext } from "./lookup.ts";

/**
 * An alternation of a group's names, for autocomplete templates.
 *
 * Read from the same theme object the rules resolve against, so a suggestion
 * can never name something the theme does not carry.
 */
export function orGroup(theme: ThemeRef, group: string): string {
  const entries = (theme[group] ?? {}) as ThemeRefGroup;
  return "(" + Object.keys(entries).join("|") + ")";
}

export function staticRules(
  names: string[],
  decls: Record<string, Record<string, string>>,
): Rule[] {
  return names.map((
    name,
  ): Rule => [name, decls[name] as Record<string, string>]);
}

export function spacingRule(
  pattern: RegExp,
  props: string[],
  autocomplete: string,
): Rule {
  return [
    pattern,
    ([, name]: string[], ctx?: ThemeContext) => {
      const path = groupOf(ctx, "spacing")[name];
      const ref = path ? path : extendedTheme(ctx, ["spacing"], name);
      if (!ref) return undefined;
      return Object.fromEntries(props.map((prop) => [prop, ref]));
    },
    { autocomplete },
  ];
}

export function insetRule(
  pattern: RegExp,
  props: string[],
  autocomplete: string,
): Rule {
  return [
    pattern,
    ([, name]: string[], ctx?: ThemeContext) => {
      const token = groupOf(ctx, "spacing")[name];
      const ref = token ? token : FRACTIONS[name] ?? INSET_KEYWORDS[name] ??
        extendedTheme(ctx, ["spacing"], name);
      if (!ref) return undefined;
      return Object.fromEntries(props.map((prop) => [prop, ref]));
    },
    { autocomplete },
  ];
}

export function divideChildren(selector: string): string {
  return `${selector} > :not([hidden]) ~ :not([hidden])`;
}
