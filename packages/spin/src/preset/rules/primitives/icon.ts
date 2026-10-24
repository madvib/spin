import type { Rule } from "@unocss/core";
import type { ThemeTokenPath } from "../../../theme/theme-types.d.ts";
import { withFallback } from "./shared.ts";

/**
 * The icon sizes, as generated rules.
 *
 * An icon's size is a token a theme decides, not a number someone wrote
 * down: `icon-sm`, `icon-md` and `icon-lg` spend `icon.sm`, `icon.md` and
 * `icon.lg` from the theme's `icon` group — dimensions a theme states in `em`,
 * so a size step scales with the control it sits in rather than pinning the
 * glyph to one absolute length.
 *
 * **The size is a font-size, and that is forced by the layers.** The glyph
 * these classes size is an icon class from `@unocss/preset-icons`, which sizes
 * itself `1em` in the `icons` layer — a layer the `primitives` layer cannot
 * beat at equal specificity, so a width or height stated here would be dead
 * the moment an icon class is present. `font-size` is the one lever that
 * reaches it: the icon class's `1em` resolves against whatever font-size the
 * element carries, so the theme's step states the glyph size and the glyph
 * tracks the button's font-size across all three of its sizes, exactly as the
 * button's icon-slot comment says it should. A theme that omits the `icon`
 * group gets no declaration and the glyph falls back to the inherited size.
 *
 * `icon-md` is the default restated as a class: the button's slot already
 * spends `icon.md`, so writing it changes nothing until a theme says
 * otherwise.
 *
 * The icon preset itself (`@unocss/preset-icons`) is a separate preset the
 * consumer composes alongside this one — see `spinPreset`'s `icons` option.
 * These rules only size the glyph; they never generate one.
 */

/** The size steps the `icon` group declares, smallest first. */
const STEPS = ["sm", "md", "lg"] as const;

const ICON_FALLBACK: Readonly<Record<"sm" | "md" | "lg", ThemeTokenPath>> = {
  sm: "font.size.sm",
  md: "font.size.md",
  lg: "font.size.xl",
};

export function iconRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("icon")) return [];
  return STEPS.map((step): Rule[] => [
    [
      new RegExp(`^icon-${step}$`),
      (_m, ctx) => {
        const size = withFallback(ctx, `icon.${step}`, ICON_FALLBACK[step]);
        return {
          [ctx.symbols.selector]: () => `.icon-${step}`,
          // An icon class from `preset-icons` sizes the glyph `1em` square
          // but leaves it `display: inline` — and a width on an inline box
          // is not applied, so the glyph's measured box is zero wherever
          // nothing else makes it one. In a flex row or a button the parent
          // does it accidentally; inline in a paragraph, which is the
          // ordinary use, it vanishes. Stating the block makes the step
          // real in every context, and `vertical-align` keeps a block-level
          // glyph sitting on the text's own mid-line.
          display: "inline-block",
          "vertical-align": "-0.125em",
          ...(size !== undefined ? { "font-size": size } : {}),
        };
      },
      { layer: "primitives", autocomplete: `icon-${step}` },
    ],
  ]).flat();
}
