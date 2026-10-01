import type { Rule } from "@unocss/core";
import type { SpinSets } from "../sets.ts";
import { OPACITY_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export function opacityRules(_sets: SpinSets): Rule[] {
  return staticRules([...OPACITY_UTILITIES], STATIC_DECLS);
}
