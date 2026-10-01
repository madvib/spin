import { symbols } from "@unocss/core";
import type { Rule } from "@unocss/core";
import { cssVarName } from "@spin/theme";
import type { SpinSets } from "../sets.ts";
import { DIVIDE_WIDTHS } from "../utils/vocabulary.ts";
import { divideChildren } from "../utils/factories.ts";
import { extendedTheme, type ThemeContext } from "../utils/lookup.ts";

export function divideRules(sets: SpinSets): Rule[] {
  return [
    [
      /^divide-([xy])(?:-(0|2|4|8))?$/,
      ([, axis, width]: string[]) => {
        const prop = axis === "x" ? "border-left-width" : "border-top-width";
        const value = DIVIDE_WIDTHS[width ?? ""];
        if (!value) return undefined;
        return { [symbols.selector]: divideChildren, [prop]: value };
      },
      { autocomplete: "divide-(x|y)-(0|2|4|8)" },
    ],
    [
      /^divide-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = sets.colors.get(name);
        const ref = path
          ? `var(${cssVarName(path)})`
          : extendedTheme(ctx, ["colors"], name);
        if (!ref) return undefined;
        return {
          [symbols.selector]: divideChildren,
          "border-color": ref,
        };
      },
      { autocomplete: "divide-$colors" },
    ],
  ];
}
