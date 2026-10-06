import type { Rule } from "@unocss/core";
import { OVERFLOW_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export const OVERFLOW_NAMES: readonly string[] = OVERFLOW_UTILITIES;

export function overflowRules(): Rule[] {
  return staticRules([...OVERFLOW_NAMES], STATIC_DECLS);
}
