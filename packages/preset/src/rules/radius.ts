import type { Rule } from "@unocss/core";
import { extendedTheme, type ThemeContext, themeOf } from "../utils/lookup.ts";

export function radiusRules(): Rule[] {
  return [
    [
      /^rounded-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = themeOf(ctx)?.radius[name];
        if (path) return { "border-radius": path };
        const extra = extendedTheme(ctx, ["radius", "borderRadius"], name);
        if (extra) return { "border-radius": extra };
        return undefined;
      },
      { autocomplete: "rounded-$radius" },
    ],
  ];
}
