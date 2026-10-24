import type { Rule } from "@unocss/core";
import { LOOP_STEP } from "@spinjs/theme";
import type { ThemeRef } from "@spinjs/theme";
import { TRANSITION_PROPERTY } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";
import { named, namesIn, type ThemeContext } from "../utils/lookup.ts";

export const TRANSITION_NAMES: readonly string[] = Object.keys(
  TRANSITION_PROPERTY,
);

/**
 * The theme's transition durations: the duration steps a transition may spend.
 *
 * The loop is not one of them — it is the period of an endless animation, and
 * the rule refuses it — so the catalogue does not name a utility the preset
 * cannot produce.
 */
export function transitionDurations(theme: ThemeRef): string[] {
  return namesIn(theme, "motion-duration").filter(
    (name) => name !== LOOP_STEP,
  );
}

export function transitionRules(): Rule[] {
  return [
    ...staticRules([...TRANSITION_NAMES], STATIC_DECLS),
    [
      /^duration-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        // The loop step is a duration but not a transition's: it is the period
        // of an endless animation — the skeleton's pulse, the spinner — and
        // spending it as a transition would make a panel take as long as a
        // pulse to arrive. The endless animations read the loop straight off
        // the custom property, so the step stays spendable where it belongs.
        if (name === LOOP_STEP) return undefined;
        const token = named(ctx, "motion-duration", name);
        if (token) return { "transition-duration": token };
        return undefined;
      },
      { autocomplete: "duration-$motionDuration" },
    ],
    [
      /^ease-(.+)$/,
      ([, name]: string[], ctx?: ThemeContext) => {
        const token = named(ctx, "motion-easing", name);
        if (token) return { "transition-timing-function": token };
        return undefined;
      },
      { autocomplete: "ease-$motionEasing" },
    ],
  ];
}
