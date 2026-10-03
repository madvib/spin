import type { Rule } from "@unocss/core";
import { INTERACTIVITY_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";
import { extendedTheme, groupOf, type ThemeContext } from "../utils/lookup.ts";

export function interactivityRules(): Rule[] {
  return [
    ...staticRules([...INTERACTIVITY_UTILITIES], STATIC_DECLS),
    // The lift reads the spacing scale the way every other transform does. A
    // component's own hover lift is a character token and stays in its CSS.
    [
      /^translate-([xy])-(.+)$/,
      ([, axis, name]: string[], ctx?: ThemeContext) => {
        const value = name === "0" ? "0" : groupOf(ctx, "spacing")[name] ??
          extendedTheme(ctx, ["spacing"], name);
        if (value === undefined) return undefined;
        return { transform: `translate${axis.toUpperCase()}(${value})` };
      },
      { autocomplete: "translate-(x|y)-$spacing" },
    ],
  ];
}
