import type { Rule } from "@unocss/core";
import { cssVarName } from "@spin/theme";
import type { SpinSets } from "../sets.ts";
import {
  FRACTIONS,
  HEIGHT_KEYWORDS,
  WIDTH_KEYWORDS,
} from "../utils/vocabulary.ts";
import { extendedTheme, type ThemeContext } from "../utils/lookup.ts";

export function sizingRules(sets: SpinSets): Rule[] {
  return [
    [
      /^w-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const token = sets.spacing.get(name);
        if (token) return { width: `var(${cssVarName(token)})` };
        const fraction = FRACTIONS[name];
        if (fraction) return { width: fraction };
        const keyword = WIDTH_KEYWORDS[name];
        if (keyword) return { width: keyword };
        const extra = extendedTheme(ctx, ["spacing"], name);
        if (extra) return { width: extra };
        return undefined;
      },
      { autocomplete: "w-$spacing" },
    ],
    [
      /^h-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const token = sets.spacing.get(name);
        if (token) return { height: `var(${cssVarName(token)})` };
        const fraction = FRACTIONS[name];
        if (fraction) return { height: fraction };
        const keyword = HEIGHT_KEYWORDS[name];
        if (keyword) return { height: keyword };
        const extra = extendedTheme(ctx, ["spacing"], name);
        if (extra) return { height: extra };
        return undefined;
      },
      { autocomplete: "h-$spacing" },
    ],
    [
      /^(min|max)-([wh])-(.+)$/,
      ([, edge, axis, name]: string[], ctx?: ThemeContext) => {
        const prop = `${edge === "min" ? "min-" : "max-"}${
          axis === "w" ? "width" : "height"
        }`;
        const keywords = axis === "w" ? WIDTH_KEYWORDS : HEIGHT_KEYWORDS;
        if (name === "screen" && axis === "w") return undefined;
        const screen = name.match(/^screen-(.+)$/)?.[1];
        if (screen && edge === "max" && axis === "w") {
          const point = sets.breakpoint.get(screen);
          if (point) return { [prop]: `var(${cssVarName(point)})` };
          const extra = extendedTheme(
            ctx,
            ["breakpoint", "breakpoints"],
            screen,
          );
          if (extra) return { [prop]: extra };
          return undefined;
        }
        if (screen) return undefined;
        if (name === "0") return { [prop]: "0" };
        const keyword = keywords[name];
        if (keyword) return { [prop]: keyword };
        return undefined;
      },
      { autocomplete: "(min|max)-(w|h)-$spacing" },
    ],
  ];
}
