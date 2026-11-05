import type { Rule } from "@unocss/core";
import { staticRules } from "../utils/factories.ts";
import { named, type ThemeContext } from "../utils/lookup.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { LEADING, OUTLINE, TEXT_TRANSFORMS, TRACKING } from "../utils/vocabulary.ts";

export const TYPOGRAPHY_NAMES: readonly string[] = [
  ...Object.keys(TEXT_TRANSFORMS),
  ...Object.keys(TRACKING).map((name) => `tracking-${name}`),
  ...Object.keys(LEADING),
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
      { autocomplete: "tracking-$tracking" },
    ],
    // Leading: the same shape — the theme's ramp first, the conventional
    // step second, inside one rule for the same shadowing reason.
    [
      /^leading-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const token = named(ctx, "font-leading", name);
        if (token !== undefined) return { "line-height": token };
        return STATIC_DECLS[`leading-${name}`];
      },
      { autocomplete: "leading-$leading" },
    ],
    // Capitalisation and the focus ring: fixed steps a theme may override
    // through `extendTheme`, but never has to name by hand.
    ...staticRules(
      [...Object.keys(TEXT_TRANSFORMS), ...Object.keys(OUTLINE)],
      STATIC_DECLS,
    ),
    // TYPE-b (remove raw type utilities): the `font-*` family/weight rule is
    // gone — families and weights arrive only inside named `type-*` styles.
    // The `text-*` size branch is gone with it: `text-*` now resolves only
    // through the color rules, so a size is an unknown class with a style
    // suggestion rather than a silent empty declaration.
  ];
}
