import type { Rule } from "@unocss/core";
import { extendedTheme, type ThemeContext, themeOf } from "../utils/lookup.ts";
import { SHADOW } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export function shadowRules(): Rule[] {
  return [
    // Steps no theme names: `shadow-none` is a look a theme asks for by name.
    ...staticRules(
      Object.keys(SHADOW).map((name) => `shadow-${name}`),
      STATIC_DECLS,
    ),
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
