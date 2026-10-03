import type { Rule } from "@unocss/core";
import { POSITION_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { insetRule, staticRules } from "../utils/factories.ts";
import { extendedTheme, type ThemeContext, themeOf } from "../utils/lookup.ts";

export function positionRules(): Rule[] {
  return [
    ...staticRules([...Object.keys(POSITION_UTILITIES)], STATIC_DECLS),
    insetRule(
      /^inset-(.+)$/,
      ["top", "right", "bottom", "left"],
      "inset-$spacing",
    ),
    insetRule(
      /^inset-x-(.+)$/,
      ["left", "right"],
      "inset-$spacing",
    ),
    insetRule(
      /^inset-y-(.+)$/,
      ["top", "bottom"],
      "inset-$spacing",
    ),
    insetRule(/^top-(.+)$/, ["top"], "inset-$spacing"),
    insetRule(/^right-(.+)$/, ["right"], "inset-$spacing"),
    insetRule(/^bottom-(.+)$/, ["bottom"], "inset-$spacing"),
    insetRule(/^left-(.+)$/, ["left"], "inset-$spacing"),
    // Logical inline insets: `start`/`end` are the inline-start and inline-end
    // offsets, so a positioned control flips with the writing mode rather than
    // against it.
    insetRule(/^start-(.+)$/, ["inset-inline-start"], "inset-$spacing"),
    insetRule(/^end-(.+)$/, ["inset-inline-end"], "inset-$spacing"),
    [
      /^z-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = themeOf(ctx)?.zIndex[name];
        if (path) return { "z-index": path };
        const extra = extendedTheme(ctx, ["zIndex"], name);
        if (extra) return { "z-index": extra };
        return undefined;
      },
      { autocomplete: "z-$zIndex" },
    ],
  ];
}
