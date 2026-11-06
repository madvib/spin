import type { SpinRule } from "../utils/lookup.ts";
import { named, type ThemeContext } from "../utils/lookup.ts";

/**
 * Named type styles, spent as utilities.
 *
 * A style is a complete tuple the theme declares under `font.style.<name>` —
 * the face, the size, the weight, the tracking, the leading — and `type-<name>`
 * spends the whole tuple at once. The utility is the `type` root plus the
 * name the theme declared, so a style added to the theme is spendable by the
 * same change that added it.
 *
 * One rule for the one root `type`, matching only it: a blanket pattern would
 * swallow `text-lg`, `tracking-wide` and every other utility, so the rule
 * matches `^type-(.+)$` and nothing wider. An undeclared name resolves to
 * nothing and the rule abstains, which is what makes an unknown style an
 * unknown class rather than a silent empty declaration.
 */
export function namedTypeRules(): SpinRule[] {
  return [
    [
      /^type-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const family = named(ctx, "font-style", `${name}-family`);
        const size = named(ctx, "font-style", `${name}-size`);
        const weight = named(ctx, "font-style", `${name}-weight`);
        const tracking = named(ctx, "font-style", `${name}-tracking`);
        const leading = named(ctx, "font-style", `${name}-leading`);
        if (
          family === undefined &&
          size === undefined &&
          weight === undefined &&
          tracking === undefined &&
          leading === undefined
        ) {
          return undefined;
        }
        return {
          ...(family !== undefined ? { "font-family": family } : {}),
          ...(size !== undefined ? { "font-size": size } : {}),
          ...(weight !== undefined ? { "font-weight": weight } : {}),
          ...(tracking !== undefined ? { "letter-spacing": tracking } : {}),
          ...(leading !== undefined ? { "line-height": leading } : {}),
        };
      },
      { autocomplete: "type-$fontStyle" },
    ],
  ];
}
