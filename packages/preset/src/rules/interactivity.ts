import type { Rule } from "@unocss/core";
import { INTERACTIVITY_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export function interactivityRules(): Rule[] {
  return staticRules([...INTERACTIVITY_UTILITIES], STATIC_DECLS);
}
