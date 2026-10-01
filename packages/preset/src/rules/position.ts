import type { Rule } from "@unocss/core";
import { cssVarName } from "@spin/theme";
import type { SpinSets } from "../sets.ts";
import { POSITION_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { insetRule, staticRules } from "../utils/factories.ts";
import { extendedTheme, type ThemeContext } from "../utils/lookup.ts";

export function positionRules(sets: SpinSets): Rule[] {
  return [
    ...staticRules([...Object.keys(POSITION_UTILITIES)], STATIC_DECLS),
    insetRule(
      sets,
      /^inset-(.+)$/,
      ["top", "right", "bottom", "left"],
      "inset-$spacing",
    ),
    insetRule(
      sets,
      /^inset-x-(.+)$/,
      ["left", "right"],
      "inset-$spacing",
    ),
    insetRule(
      sets,
      /^inset-y-(.+)$/,
      ["top", "bottom"],
      "inset-$spacing",
    ),
    insetRule(sets, /^top-(.+)$/, ["top"], "inset-$spacing"),
    insetRule(sets, /^right-(.+)$/, ["right"], "inset-$spacing"),
    insetRule(sets, /^bottom-(.+)$/, ["bottom"], "inset-$spacing"),
    insetRule(sets, /^left-(.+)$/, ["left"], "inset-$spacing"),
    [
      /^z-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const path = sets.zIndex.get(name);
        if (path) return { "z-index": `var(${cssVarName(path)})` };
        const extra = extendedTheme(ctx, ["zIndex"], name);
        if (extra) return { "z-index": extra };
        return undefined;
      },
      { autocomplete: "z-$zIndex" },
    ],
  ];
}
