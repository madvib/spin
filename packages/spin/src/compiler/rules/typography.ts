import type { Rule } from "@unocss/core";
import { staticRules } from "../utils/factories.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { OUTLINE, TEXT_TRANSFORMS } from "../utils/vocabulary.ts";

export const TYPOGRAPHY_NAMES: readonly string[] = [
  ...Object.keys(TEXT_TRANSFORMS),
  ...Object.keys(OUTLINE),
];


export function typographyRules(): Rule[] {
  return [
    // TYPE-c (styles own type): the `tracking-*`/`leading-*` dynamic rules
    // are gone — single-decision adjustments ride placement-open `type-*`
    // plus styles, never a parallel atom path. What remains is the
    // capitalisation and the focus ring: fixed steps a theme may override
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
