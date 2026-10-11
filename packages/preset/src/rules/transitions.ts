import type { Rule } from "@unocss/core";
import { TRANSITION_PROPERTY } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";
import { type ThemeContext, tokenOf } from "../utils/lookup.ts";

export const TRANSITION_NAMES: readonly string[] = Object.keys(
  TRANSITION_PROPERTY,
);

export function transitionRules(): Rule[] {
  return [
    ...staticRules([...TRANSITION_NAMES], STATIC_DECLS),
    [
      /^duration-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const token = tokenOf(
          ctx,
          "motionDuration",
          name,
          "transitionDuration",
        );
        if (token) return { "transition-duration": token };
        return undefined;
      },
      { autocomplete: "duration-$motionDuration" },
    ],
    [
      /^ease-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const token = tokenOf(
          ctx,
          "motionEasing",
          name,
          "transitionTimingFunction",
        );
        if (token) return { "transition-timing-function": token };
        return undefined;
      },
      { autocomplete: "ease-$motionEasing" },
    ],
  ];
}
