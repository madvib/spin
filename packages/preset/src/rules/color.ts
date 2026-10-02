import type { Rule } from "@unocss/core";
import { cssVarName } from "@spin/theme";
import type { SpinSets } from "../sets.ts";
import { extendedTheme, type ThemeContext } from "../utils/lookup.ts";
import { COLOR_KEYWORDS } from "../utils/vocabulary.ts";

/**
 * Colour, resolved through the theme.
 *
 * A keyword is colour vocabulary rather than a token: `transparent` and
 * `currentColor` are values a stylesheet may legitimately name, and a component
 * that must be see-through cannot express that any other way. They resolve to
 * themselves so `bg-transparent` means exactly what it says and never becomes
 * whatever is behind it.
 */
function colorOf(
  sets: SpinSets,
  ctx: ThemeContext | undefined,
  name: string,
  property: "background-color" | "border-color" | "color",
): Record<string, string> | undefined {
  const path = sets.colors.get(name);
  if (path) return { [property]: `var(${cssVarName(path)})` };
  if ((COLOR_KEYWORDS as readonly string[]).includes(name)) {
    return { [property]: name };
  }
  const extra = extendedTheme(ctx, ["colors"], name);
  if (extra) return { [property]: extra };
  return undefined;
}

export function colorRules(sets: SpinSets): Rule[] {
  return [
    [
      /^bg-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) =>
        colorOf(sets, ctx, name, "background-color"),
      { autocomplete: "bg-$colors" },
    ],
    [
      /^border-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) =>
        colorOf(sets, ctx, name, "border-color"),
      { autocomplete: "border-$colors" },
    ],
    [
      /^text-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        // `text-lg` is a size; only a colour name reaches this branch.
        const resolved = colorOf(sets, ctx, name, "color");
        return resolved;
      },
      { autocomplete: "text-$colors" },
    ],
  ];
}
