import type { SpinRule } from "../utils/lookup.ts";
import { named, type ThemeContext } from "../utils/lookup.ts";
import { SHADOW } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export const SHADOW_NAMES: readonly string[] = Object.keys(SHADOW).map(
  (name) => `shadow-${name}`,
);

export function shadowRules(): SpinRule[] {
  return [
    // Steps no theme names: `shadow-none` is a look a theme asks for by name.
    ...staticRules([...SHADOW_NAMES], STATIC_DECLS),
    [
      /^shadow-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const token = named(ctx, "shadow", name);
        if (token) return { "box-shadow": token };
        return undefined;
      },
      { autocomplete: "shadow-$shadow" },
    ],
  ];
}
