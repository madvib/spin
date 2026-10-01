import type { Rule } from "@unocss/core";
import type { SpinSets } from "../sets.ts";
import { INTERACTIVITY_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export function interactivityRules(_sets: SpinSets): Rule[] {
  return staticRules([...INTERACTIVITY_UTILITIES], STATIC_DECLS);
}
