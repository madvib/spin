import type { Rule } from "@unocss/core";
import { extendedTheme, type ThemeContext, themeOf } from "../utils/lookup.ts";

export function typographyRules(): Rule[] {
  return [
    [
      /^font-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const family = themeOf(ctx)?.fontFamily[name];
        if (family) return { "font-family": family };
        const weight = themeOf(ctx)?.fontWeight[name];
        if (weight) return { "font-weight": weight };
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
        const size = themeOf(ctx)?.fontSize[name];
        if (size) return { "font-size": size };
        const color = themeOf(ctx)?.colors[name];
        if (color) return { color: color };
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
