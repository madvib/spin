import type { Rule } from "@unocss/core";
import { staticRules } from "../utils/factories.ts";
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
        const token = named(ctx, "font-tracking", name);
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
    // T2 (remove the type hatch): type sizes come from the scale — there is
    // no arbitrary branch here, so `text-[14px]` matches no rule and is dead
    // on arrival (closed-vocabulary and `strictClasses` catch it like a typo).
    // The `text-*` size rule below resolves only steps the theme declares.
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
