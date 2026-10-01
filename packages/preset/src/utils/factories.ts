import type { Rule } from "@unocss/core";
import { cssVarName } from "@spin/theme";
import { FRACTIONS, INSET_KEYWORDS } from "./vocabulary.ts";
import type { NameMap, SpinSets } from "../sets.ts";
import { extendedTheme, type ThemeContext } from "./lookup.ts";

export function orGroup(map: NameMap): string {
  return `(${[...map.keys()].join("|")})`;
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
  sets: SpinSets,
  pattern: RegExp,
  props: string[],
  autocomplete: string,
): Rule {
  return [
    pattern,
    ([, name]: string[], ctx?: ThemeContext) => {
      const path = sets.spacing.get(name);
      const ref = path
        ? `var(${cssVarName(path)})`
        : extendedTheme(ctx, ["spacing"], name);
      if (!ref) return undefined;
      return Object.fromEntries(props.map((prop) => [prop, ref]));
    },
    { autocomplete },
  ];
}

export function insetRule(
  sets: SpinSets,
  pattern: RegExp,
  props: string[],
  autocomplete: string,
): Rule {
  return [
    pattern,
    ([, name]: string[], ctx?: ThemeContext) => {
      const token = sets.spacing.get(name);
      const ref = token
        ? `var(${cssVarName(token)})`
        : FRACTIONS[name] ?? INSET_KEYWORDS[name] ??
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
