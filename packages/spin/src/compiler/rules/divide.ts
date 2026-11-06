import { symbols } from "@unocss/core";
import type { SpinRule } from "../utils/lookup.ts";
import { divideChildren } from "../utils/factories.ts";
import { named, type ThemeContext } from "../utils/lookup.ts";
import { hasRawColor } from "../utils/color.ts";

/**
 * The width suffixes the theme's `border` family declares, read off the
 * flat theme map: `width` is the bare axis, `width-0` is `-0`, and each
 * `width-<n>` is `-<n>`. A width the theme does not declare is never named.
 */
function widthSuffixes(theme: Record<string, unknown>): string[] {
  const suffixes = new Set<string>(["", "-0"]);
  for (const key of Object.keys(theme)) {
    if (key.startsWith("border-width-")) {
      suffixes.add(`-${key.slice("border-width-".length)}`);
    }
  }
  return [...suffixes];
}

/**
 * Every `divide-*` name these rules match.
 *
 * Three forms, because the two rules accept three things: an axis with a
 * width (`divide-x-4`), a bare axis (`divide-x` — the theme's own hairline),
 * and a colour (`divide-primary`, which is the SAME rule with a colour where
 * the width goes). The widths are the theme's `border` ladder, so a weight
 * the theme does not declare is never advertised.
 */
export function divideNames(
  colors: readonly string[] = [],
  theme: Record<string, unknown> = {},
): readonly string[] {
  return [
    ...["x", "y"].flatMap((axis) =>
      widthSuffixes(theme).map((suffix) => `divide-${axis}${suffix}`)
    ),
    ...colors
      .filter((c) => c !== "border" && c !== "text" && c !== "text-muted")
      .map((c) => `divide-${c === "border-strong" ? "strong" : c}`),
  ];
}

export function divideRules(): SpinRule[] {
  return [
    [
      /^divide-([xy])(?:-(0|\d+))?$/,
      ([, axis, width]: string[], ctx?: ThemeContext) => {
        const prop = axis === "x" ? "border-left-width" : "border-top-width";
        if (width === undefined) {
          const value = ctx?.theme?.border?.width;
          if (value === undefined) return undefined;
          const borderColor = ctx?.theme?.color?.border;
          return {
            [symbols.selector]: divideChildren,
            [prop]: value,
            "border-style": "solid",
            ...(borderColor !== undefined ? { "border-color": borderColor } : {}),
          };
        }
        if (width === "0") return { [symbols.selector]: divideChildren, [prop]: "0px" };
        const value = named(ctx, "border", `width-${width}`);
        if (value === undefined) return undefined;
        const borderColor = ctx?.theme?.color?.border;
        return {
          [symbols.selector]: divideChildren,
          [prop]: value,
          "border-style": "solid",
          ...(borderColor !== undefined ? { "border-color": borderColor } : {}),
        };
      },
      { autocomplete: "divide-(x|y)-(0|2|4|8)" },
    ],
    [
      /^divide-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        // As `bg-`: a raw colour is a design decision, and a design decision
        // is a token. `divide-[#fff]` is dead on arrival — it produces no
        // CSS at all, and the ordinary vocabulary rule catches it the way
        // it catches a typo. The stuttered roles (`divide-border`,
        // `divide-text`, `divide-text-muted`) are dead with it — the
        // strong divide is `divide-strong` (`color.border-strong`).
        if (hasRawColor(name)) return undefined;
        if (
          name === "border" || name.startsWith("border/") ||
          name === "border-strong" || name.startsWith("border-strong/") ||
          name === "text" || name.startsWith("text/") ||
          name === "text-muted" || name.startsWith("text-muted/")
        ) return undefined;
        const mapped = name === "strong"
          ? "border-strong"
          : name.startsWith("strong/") ? `border-${name}` : name;
        const ref = named(ctx, "color", mapped);
        if (!ref) return undefined;
        return {
          [symbols.selector]: divideChildren,
          "border-color": ref,
        };
      },
      { autocomplete: "divide-$colors" },
    ],
  ];
}
