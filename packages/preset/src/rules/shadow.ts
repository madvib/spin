import type { Rule } from "@unocss/core";
import { extendedTheme, type ThemeContext, themeOf } from "../utils/lookup.ts";

export function shadowRules(): Rule[] {
  return [
    [
      /^shadow-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = themeOf(ctx)?.shadow[name];
        if (path) return { "box-shadow": path };
        const extra = extendedTheme(ctx, ["shadow", "boxShadow"], name);
        if (extra) return { "box-shadow": extra };
        return undefined;
      },
      { autocomplete: "shadow-$shadow" },
    ],
  ];
}
