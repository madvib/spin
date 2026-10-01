import type { Rule } from "@unocss/core";
import type { SpinSets } from "../sets.ts";
import { OVERFLOW_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export function overflowRules(_sets: SpinSets): Rule[] {
  return staticRules([...OVERFLOW_UTILITIES], STATIC_DECLS);
}
