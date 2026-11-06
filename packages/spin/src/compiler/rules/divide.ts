import { symbols } from "@unocss/core";
import type { SpinRule } from "../utils/lookup.ts";
import { DIVIDE_WIDTHS } from "../utils/vocabulary.ts";
import { divideChildren } from "../utils/factories.ts";
import { named, type ThemeContext } from "../utils/lookup.ts";
import { hasRawColor } from "../utils/color.ts";

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
    ...colors
      .filter((c) => c !== "border" && c !== "text" && c !== "text-muted")
      .map((c) => `divide-${c === "border-strong" ? "strong" : c}`),
  ];
}

/** The axis-width names, for a caller with no theme to read colours from. */
export const DIVIDE_NAMES: readonly string[] = divideNames();

export function divideRules(): SpinRule[] {
  return [
    [
      /^divide-([xy])(?:-(0|2|4|8))?$/,
      ([, axis, width]: string[], ctx?: ThemeContext) => {
        const prop = axis === "x" ? "border-left-width" : "border-top-width";
        const value = DIVIDE_WIDTHS[width ?? ""];
        if (!value) return undefined;
        if (width === "0") return { [symbols.selector]: divideChildren, [prop]: value };
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
