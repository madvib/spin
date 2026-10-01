import type { Rule } from "@unocss/core";
import { cssVarName } from "@spin/theme";
import type { SpinSets } from "../sets.ts";
import { extendedTheme, type ThemeContext } from "../utils/lookup.ts";

export function colorRules(sets: SpinSets): Rule[] {
  return [
    [
      /^bg-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = sets.colors.get(name);
        if (path) return { "background-color": `var(${cssVarName(path)})` };
        const extra = extendedTheme(ctx, ["colors"], name);
        if (extra) return { "background-color": extra };
        return undefined;
      },
      { autocomplete: "bg-$colors" },
    ],
    [
      /^border-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = sets.colors.get(name);
        if (path) return { "border-color": `var(${cssVarName(path)})` };
        const extra = extendedTheme(ctx, ["colors"], name);
        if (extra) return { "border-color": extra };
        return undefined;
      },
      { autocomplete: "border-$colors" },
    ],
  ];
}
