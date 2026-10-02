import type { Rule } from "@unocss/core";
import { extendedTheme, type ThemeContext, themeOf } from "../utils/lookup.ts";
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
  ctx: ThemeContext | undefined,
  name: string,
  property: "background-color" | "border-color" | "color",
): Record<string, string> | undefined {
  const path = themeOf(ctx)?.colors[name];
  if (path) return { [property]: path };
  if ((COLOR_KEYWORDS as readonly string[]).includes(name)) {
    return { [property]: name };
  }
  const extra = extendedTheme(ctx, ["colors"], name);
  if (extra) return { [property]: extra };
  return undefined;
}

export function colorRules(): Rule[] {
  return [
    [
      /^bg-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) =>
        colorOf(ctx, name, "background-color"),
      { autocomplete: "bg-$colors" },
    ],
    [
      /^border-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) =>
        colorOf(ctx, name, "border-color"),
      { autocomplete: "border-$colors" },
    ],
    [
      /^text-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        // `text-lg` is a size; only a colour name reaches this branch.
        const resolved = colorOf(ctx, name, "color");
        return resolved;
      },
      { autocomplete: "text-$colors" },
    ],
  ];
}
