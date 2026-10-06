import type { Rule } from "@unocss/core";
import { TRANSITION_PROPERTY } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";
import { extendedTheme, type ThemeContext, themeOf } from "../utils/lookup.ts";

export const TRANSITION_NAMES: readonly string[] = Object.keys(
  TRANSITION_PROPERTY,
);

export function transitionRules(): Rule[] {
  return [
    ...staticRules([...TRANSITION_NAMES], STATIC_DECLS),
    [
      /^duration-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = themeOf(ctx)?.motionDuration[name];
        if (path) {
          return { "transition-duration": path };
        }
        const extra = extendedTheme(ctx, ["transitionDuration"], name);
        if (extra) return { "transition-duration": extra };
        return undefined;
      },
      { autocomplete: "duration-$motionDuration" },
    ],
    [
      /^ease-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = themeOf(ctx)?.motionEasing[name];
        if (path) {
          return {
            "transition-timing-function": path,
          };
        }
        const extra = extendedTheme(ctx, ["transitionTimingFunction"], name);
        if (extra) return { "transition-timing-function": extra };
        return undefined;
      },
      { autocomplete: "ease-$motionEasing" },
    ],
  ];
}
