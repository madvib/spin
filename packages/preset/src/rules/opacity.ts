import type { Rule } from "@unocss/core";
import { OPACITY_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export const OPACITY_NAMES: readonly string[] = OPACITY_UTILITIES;

export function opacityRules(): Rule[] {
  return staticRules([...OPACITY_NAMES], STATIC_DECLS);
}
