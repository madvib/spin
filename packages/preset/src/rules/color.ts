import type { Rule } from "@unocss/core";
import { named, type ThemeContext } from "../utils/lookup.ts";
import { COLOR_KEYWORDS } from "../utils/vocabulary.ts";
import { hasRawColor } from "../utils/color.ts";

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
  property: "background-color" | "border-color" | "color" | "accent-color",
): Record<string, string> | undefined {
  // A raw colour is a design decision, and a design decision in this system
  // is a TOKEN: the theme's palette is where colours live, and a colour
  // written into a class is the theme refusing to have an opinion about
  // one. So the class is DEAD ON ARRIVAL — `bg-[#fff]` produces no CSS at
  // all, and the ordinary vocabulary rule catches it the way it catches a
  // typo. The refusal is on the COLOUR rather than on the bracket: a size
  // in a colour position is not a colour either, and it resolves to
  // nothing for the reason it always did — the theme carries no such
  // token.
  if (hasRawColor(name)) return undefined;
  const path = named(ctx, "color", name);
  if (path) return { [property]: path };
  if ((COLOR_KEYWORDS as readonly string[]).includes(name)) {
    return { [property]: name };
  }
  return undefined;
}

export function colorRules(): Rule[] {
  return [
    [
      /^bg-(.+)$/,
      ([, name = ""]: string[], ctx?: ThemeContext) =>
        colorOf(ctx, name, "background-color"),
      { autocomplete: "bg-$colors" },
    ],
    [
      /^border-(.+)$/,
      ([, name = ""]: string[], ctx?: ThemeContext) =>
        colorOf(ctx, name, "border-color"),
      { autocomplete: "border-$colors" },
    ],
    [
      /^text-(.+)$/,
      ([, name = ""]: string[], ctx?: ThemeContext) => {
        // `text-lg` is a size; only a colour name reaches this branch. A theme
        // may name a colour after the utility itself — the baseline theme's
        // `text-muted` is `color.text-muted` — so the prefixed name is tried
        // alongside the bare one.
        const resolved = colorOf(ctx, name, "color") ??
          colorOf(ctx, `text-${name}`, "color");
        return resolved;
      },
      { autocomplete: "text-$colors" },
    ],
    [
      /^accent-(.+)$/,
      ([, name = ""]: string[], ctx?: ThemeContext) =>
        colorOf(ctx, name, "accent-color"),
      { autocomplete: "accent-$colors" },
    ],
  ];
}
