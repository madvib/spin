import type { Rule } from "@unocss/core";
import { arbitraryValue, staticRules } from "../utils/factories.ts";
import { named, type ThemeContext } from "../utils/lookup.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { OUTLINE, TEXT_TRANSFORMS, TRACKING } from "../utils/vocabulary.ts";

export const TYPOGRAPHY_NAMES: readonly string[] = [
  ...Object.keys(TEXT_TRANSFORMS),
  ...Object.keys(TRACKING).map((name) => `tracking-${name}`),
  ...Object.keys(OUTLINE),
];

export function typographyRules(): Rule[] {
  return [
    // Tracking: the theme's own ramp first, the conventional step second.
    // The fallback lives inside this rule rather than in a static entry
    // beside it because an exact-name rule outranks a pattern regardless of
    // registration order — a static twin would shadow the theme forever.
    [
      /^tracking-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const token = named(ctx, "font-letter-spacing", name);
        if (token !== undefined) return { "letter-spacing": token };
        return STATIC_DECLS[`tracking-${name}`];
      },
      { autocomplete: "tracking-$letterSpacing" },
    ],
    // Capitalisation and the focus ring: fixed steps a theme may override
    // through `extendTheme`, but never has to name by hand.
    ...staticRules(
      [...Object.keys(TEXT_TRANSFORMS), ...Object.keys(OUTLINE)],
      STATIC_DECLS,
    ),
    [
      /^font-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const family = named(ctx, "font-family", name);
        if (family) return { "font-family": family };
        const weight = named(ctx, "font-weight", name);
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
    // The hatch refuses it by the same rule every other arbitrary value is
    // read by — see `utils/color.ts` — so the class is dead on arrival
    // rather than broken.
    [
      /^text-(.+)$/,
      ([, name]: string[]) => {
        const literal = arbitraryValue(name);
        return literal === undefined ? undefined : { "font-size": literal };
      },
    ],
    [
      /^text-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        // T5 (remove `text-text`): the twin carve-out to `color.ts` — the
        // later-registered color branch is tried first, so this branch also
        // refuses the exact name rather than resolving the bare token.
        if (name === "text") return undefined;
        const size = named(ctx, "font-size", name);
        if (size) return { "font-size": size };
        const color = named(ctx, "color", name);
        if (color) return { color: color };
        return undefined;
      },
      { autocomplete: "text-$fontSize" },
    ],
  ];
}
