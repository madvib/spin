import type { Rule } from "@unocss/core";
import { cssVarName } from "@spin/theme";
import type { SpinSets } from "../sets.ts";
import { extendedTheme, type ThemeContext } from "../utils/lookup.ts";

export function shadowRules(sets: SpinSets): Rule[] {
  return [
    [
      /^shadow-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = sets.shadow.get(name);
        if (path) return { "box-shadow": `var(${cssVarName(path)})` };
        const extra = extendedTheme(ctx, ["shadow", "boxShadow"], name);
        if (extra) return { "box-shadow": extra };
        return undefined;
      },
      { autocomplete: "shadow-$shadow" },
    ],
  ];
}
