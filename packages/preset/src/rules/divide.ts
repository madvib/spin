import { symbols } from "@unocss/core";
import type { Rule } from "@unocss/core";
import { DIVIDE_WIDTHS } from "../utils/vocabulary.ts";
import { divideChildren } from "../utils/factories.ts";
import { extendedTheme, type ThemeContext, themeOf } from "../utils/lookup.ts";

export function divideRules(): Rule[] {
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
        const path = themeOf(ctx)?.colors[name];
        const ref = path ? path : extendedTheme(ctx, ["colors"], name);
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
