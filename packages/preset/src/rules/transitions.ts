import type { Rule } from "@unocss/core";
import { cssVarName } from "@spin/theme";
import type { SpinSets } from "../sets.ts";
import { TRANSITION_PROPERTY } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";
import { extendedTheme, type ThemeContext } from "../utils/lookup.ts";

export function transitionRules(sets: SpinSets): Rule[] {
  return [
    ...staticRules([...Object.keys(TRANSITION_PROPERTY)], STATIC_DECLS),
    [
      /^duration-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = sets.motionDuration.get(name);
        if (path) {
          return { "transition-duration": `var(${cssVarName(path)})` };
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
        const path = sets.motionEasing.get(name);
        if (path) {
          return {
            "transition-timing-function": `var(${cssVarName(path)})`,
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
