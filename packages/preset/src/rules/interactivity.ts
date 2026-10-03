import type { Rule } from "@unocss/core";
import { INTERACTIVITY_UTILITIES, TRANSFORM } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";
import { extendedTheme, groupOf, type ThemeContext } from "../utils/lookup.ts";

export function interactivityRules(): Rule[] {
  return [
    ...staticRules([...INTERACTIVITY_UTILITIES], STATIC_DECLS),
    // The lift reads the theme the way every other token consumer does.
    ...TRANSFORM.map((name): Rule => [
      new RegExp(`^${name}$`),
      ([, token]: string[], ctx?: ThemeContext) => {
        const group = name.startsWith("translate-x") ? "button-hover-lift-x"
          : "button-hover-lift-y";
        const value = groupOf(ctx, "button")[token] ??
          groupOf(ctx, group)[token] ??
          extendedTheme(ctx, ["button"], token);
        if (value === undefined) return undefined;
        const axis = name.endsWith("x") ? "X" : "Y";
        return { transform: `translate${axis}(${value})` };
      },
      { autocomplete: name },
    ]),
  ];
}
