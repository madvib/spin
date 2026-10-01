import type { Rule } from "@unocss/core";
import { cssVarName } from "@spin/theme";
import type { SpinSets } from "../sets.ts";
import { extendedTheme, type ThemeContext } from "../utils/lookup.ts";

export function typographyRules(sets: SpinSets): Rule[] {
  return [
    [
      /^font-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const family = sets.fontFamily.get(name);
        if (family) return { "font-family": `var(${cssVarName(family)})` };
        const weight = sets.fontWeight.get(name);
        if (weight) return { "font-weight": `var(${cssVarName(weight)})` };
        const extraFamily = extendedTheme(ctx, ["fontFamily"], name);
        if (extraFamily) return { "font-family": extraFamily };
        const extraWeight = extendedTheme(ctx, ["fontWeight"], name);
        if (extraWeight) return { "font-weight": extraWeight };
        return undefined;
      },
      { autocomplete: "font-$fontFamily" },
    ],
    [
      /^text-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const size = sets.fontSize.get(name);
        if (size) return { "font-size": `var(${cssVarName(size)})` };
        const color = sets.colors.get(name);
        if (color) return { color: `var(${cssVarName(color)})` };
        const extraSize = extendedTheme(ctx, ["fontSize"], name);
        if (extraSize) return { "font-size": extraSize };
        const extraColor = extendedTheme(ctx, ["colors"], name);
        if (extraColor) return { color: extraColor };
        return undefined;
      },
      { autocomplete: "text-$fontSize" },
    ],
  ];
}
