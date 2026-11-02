import type { Rule } from "@unocss/core";
import { named, type ThemeContext } from "../utils/lookup.ts";
import { CORNER_LOGICAL } from "../utils/vocabulary.ts";

/**
 * Corner radii, by radius and by corner.
 *
 * `rounded-md` rounds every corner; `rounded-ss-md` rounds the start-start one.
 * The logical suffixes are what a joined group needs — a group of buttons
 * rounds only its outer corners, and which corners those are follows the
 * writing mode rather than the viewport.
 *
 * Both resolve the same radius scale, so a theme moves them together and a
 * component never names a value: it names the radius it wants.
 */
export function radiusRules(): Rule[] {
  return [
    [
      // A corner suffix followed by a radius: `rounded-ss-md`.
      new RegExp(`^rounded-(${Object.keys(CORNER_LOGICAL).join("|")})-(.+)$`),
      ([, corner, name]: string[], ctx?: ThemeContext) => {
        const property = CORNER_LOGICAL[corner];
        const value = radiusOf(name, ctx);
        if (property === undefined || value === undefined) return undefined;
        return { [property]: value };
      },
      {
        autocomplete: `rounded-(${
          Object.keys(CORNER_LOGICAL).join("|")
        })-$radius`,
      },
    ],
    [
      /^rounded-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const value = radiusOf(name, ctx);
        return value === undefined ? undefined : { "border-radius": value };
      },
      { autocomplete: "rounded-$radius" },
    ],
  ];
}

/** A radius from the theme, falling back to an extended one. */
function radiusOf(
  name: string,
  ctx?: ThemeContext,
): string | undefined {
  return named(ctx, "radius", name);
}
