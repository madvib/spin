import { symbols } from "@unocss/core";
import type { Rule } from "@unocss/core";
import { DIVIDE_WIDTHS } from "../utils/vocabulary.ts";
import { divideChildren } from "../utils/factories.ts";
import { type ThemeContext, tokenOf } from "../utils/lookup.ts";

/** Every width the divide rule accepts, as the class suffix it matches. */
const WIDTHS = Object.keys(DIVIDE_WIDTHS).filter((w) => w !== "");

/**
 * Every `divide-*` name these rules match.
 *
 * Three forms, because the two rules accept three things: an axis with a
 * width (`divide-x-4`), a bare axis (`divide-x` — the one-pixel divide), and a
 * colour (`divide-primary`, which is the SAME rule with a colour where the
 * width goes). The previous list had the first and omitted the other two, so
 * the reference advertised a name that did nothing and hid every colour
 * divide.
 */
export function divideNames(colors: readonly string[] = []): readonly string[] {
  return [
    ...["x", "y"].flatMap((axis) =>
      [undefined, ...WIDTHS].map((w) => `divide-${axis}${w ? `-${w}` : ""}`)
    ),
    ...colors.map((c) => `divide-${c}`),
  ];
}

/** The axis-width names, for a caller with no theme to read colours from. */
export const DIVIDE_NAMES: readonly string[] = divideNames();

export function divideRules(): Rule[] {
  return [
    [
      /^divide-([xy])(?:-(0|2|4|8))?$/,
      ([, axis, width]: string[]) => {
        const prop = axis === "x" ? "border-left-width" : "border-top-width";
        const value = DIVIDE_WIDTHS[width ?? ""];
        if (!value) return undefined;
        return { [symbols.selector]: divideChildren, [prop]: value };
      },
      { autocomplete: "divide-(x|y)-(0|2|4|8)" },
    ],
    [
      /^divide-(.+)$/,
      ([, name = ""]: string[], ctx?: ThemeContext) => {
        const ref = tokenOf(ctx, "colors", name);
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
