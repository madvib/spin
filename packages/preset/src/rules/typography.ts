import type { Rule } from "@unocss/core";
import { arbitraryValue, staticRules } from "../utils/factories.ts";
import { type ThemeContext, tokenOf } from "../utils/lookup.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { NUMERIC_VARIANTS, OUTLINE, TEXT_TRANSFORMS, TRACKING } from "../utils/vocabulary.ts";

export const TYPOGRAPHY_NAMES: readonly string[] = [
  ...Object.keys(NUMERIC_VARIANTS),
  ...Object.keys(TEXT_TRANSFORMS),
  ...Object.keys(TRACKING).map((name) => `tracking-${name}`),
  ...Object.keys(OUTLINE),
];

export function typographyRules(): Rule[] {
  return [
    // Capitalisation, tracking, and the focus ring: fixed steps a theme may
    // override through `extendTheme`, but never has to name by hand.
    ...staticRules([...TYPOGRAPHY_NAMES], STATIC_DECLS),
    [
      /^font-(.+)$/,
      ([, name = ""]: string[], ctx?: ThemeContext) => {
        const family = tokenOf(ctx, "fontFamily", name);
        if (family) return { "font-family": family };
        const weight = tokenOf(ctx, "fontWeight", name);
        if (weight) return { "font-weight": weight };
        return undefined;
      },
      { autocomplete: "font-$fontFamily" },
    ],
    // `text-[15px]`: the escape hatch, and the only font size here that is not
    // a theme token. Every other value the `text-` rules below emit is a step
    // the theme declares — `fontSize` for the size, `colors` for the tint —
    // and one it does not declare means the rule omits itself. An arbitrary
    // value is the CALLER supplying the number, which is the entire purpose of
    // the hatch: the theme has no opinion about 15px, so this is not a themed
    // value and must not pretend to be one. Emitted as written, or not at all.
    //
    // A raw colour is deliberately NOT reachable this way. `text-[#bada55]`
    // would name a colour the theme has never vetted, which is a different
    // decision from naming a number: a size the theme does not carry is a
    // missing step, a colour it does not carry is an unapproved palette.
    [
      /^text-(.+)$/,
      ([, name = ""]: string[]) => {
        const literal = arbitraryValue(name);
        return literal === undefined ? undefined : { "font-size": literal };
      },
    ],
    [
      /^text-(.+)$/,
      ([, name = ""]: string[], ctx?: ThemeContext) => {
        const size = tokenOf(ctx, "fontSize", name);
        if (size) return { "font-size": size };
        const color = tokenOf(ctx, "colors", name);
        if (color) return { color: color };
        return undefined;
      },
      { autocomplete: "text-$fontSize" },
    ],
  ];
}
