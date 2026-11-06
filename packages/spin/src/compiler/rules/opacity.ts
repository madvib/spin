import type { SpinRule } from "../utils/lookup.ts";
import {
  OPACITY_STEPS,
  OPACITY_UTILITIES,
  opacityValue,
} from "../utils/vocabulary.ts";

export const OPACITY_NAMES: readonly string[] = OPACITY_UTILITIES;

/**
 * The opacity utilities.
 *
 * Exact-name rules, one per conventional step, whose value reads the theme's
 * own step with the conventional fraction as its fallback. The read travels
 * as a `var(..., fallback)` rather than being resolved at generation time
 * because `opacity-*` is a namespace wind4 also serves through a dynamic
 * pattern, and an exact name is the only shape that outranks a pattern — so
 * the theme's answer has to travel inside the value, the same way every other
 * token reference does. A theme that states no step resolves to the fraction
 * the table always carried.
 */
export function opacityRules(): SpinRule[] {
  return OPACITY_STEPS.map((step): SpinRule => [
    `opacity-${step}`,
    {
      opacity: `var(--opacity-${step}, ${opacityValue(`opacity-${step}`)})`,
    },
  ]);
}
