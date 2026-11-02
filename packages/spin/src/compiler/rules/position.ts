import type { Rule } from "@unocss/core";
import { POSITION_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { insetRule, staticRules } from "../utils/factories.ts";
import { named, type ThemeContext } from "../utils/lookup.ts";

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
        const token = named(ctx, "z-index", name);
        if (token) return { "z-index": token };
        return undefined;
      },
      { autocomplete: "z-$zIndex" },
    ],
    // Anchors: pinning a top-layer panel to its trigger.
    //
    // A native popover lives in the top layer, where no ancestor positions
    // it — `absolute top-full` names the viewport, not the trigger. The
    // platform's own answer is anchor positioning: the trigger names
    // itself, and the panel names the trigger and the area it takes beside
    // it. The names are per-instance (`anchor-theme-popover`); the areas
    // are the vocabulary, a side with an optional span. The spans are
    // physical (`span-right` aligns under a left-anchored trigger in LTR),
    // measured in the browser, not assumed from the grammar.
    [
      /^anchor-([\w-]+)$/,
      ([, name]: string[]) => ({ "anchor-name": `--${name}` }),
      { autocomplete: "anchor-<name>" },
    ],
    [
      /^position-anchor-([\w-]+)$/,
      ([, name]: string[]) => ({ "position-anchor": `--${name}` }),
      { autocomplete: "position-anchor-<name>" },
    ],
    [
      /^position-area-(top|right|bottom|left|center)(-(span-(all|left|right|top|bottom)))?$/,
      ([, side, , span]: string[]) => ({
        "position-area": span === undefined ? side : `${side} ${span}`,
      }),
      { autocomplete: "position-area-(top|right|bottom|left|center)" },
    ],
  ];
}
