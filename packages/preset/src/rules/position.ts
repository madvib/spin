import type { Rule } from "@unocss/core";
import { POSITION_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { insetRule, staticRules } from "../utils/factories.ts";
import { type ThemeContext, tokenOf } from "../utils/lookup.ts";

export const POSITION_NAMES: readonly string[] = Object.keys(
  POSITION_UTILITIES,
);

export function positionRules(): Rule[] {
  // The inset family below takes an arbitrary value as well as a token:
  // `top-[3px]`, `inset-x-[calc(100%_-_2rem)]`. That branch lives in
  // `insetRule` with the grammar it accepts, since every axis here shares it;
  // the reason a literal is correct at all is written there.
  return [
    ...staticRules([...POSITION_NAMES], STATIC_DECLS),
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
        const token = tokenOf(ctx, "zIndex", name);
        if (token) return { "z-index": token };
        return undefined;
      },
      { autocomplete: "z-$zIndex" },
    ],
  ];
}
