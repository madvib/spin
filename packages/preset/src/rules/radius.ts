import type { Rule } from "@unocss/core";
import { cssVarName } from "@spin/theme";
import type { SpinSets } from "../sets.ts";
import { extendedTheme, type ThemeContext } from "../utils/lookup.ts";

export function radiusRules(sets: SpinSets): Rule[] {
  return [
    [
      /^rounded-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = sets.radius.get(name);
        if (path) return { "border-radius": `var(${cssVarName(path)})` };
        const extra = extendedTheme(ctx, ["radius", "borderRadius"], name);
        if (extra) return { "border-radius": extra };
        return undefined;
      },
      { autocomplete: "rounded-$radius" },
    ],
  ];
}
