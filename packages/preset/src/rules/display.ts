import type { Rule } from "@unocss/core";
import type { SpinSets } from "../sets.ts";
import {
  DISPLAY_UTILITIES,
  STATIC_UTILITIES,
  VISIBILITY,
} from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export function displayRules(_sets: SpinSets): Rule[] {
  return staticRules(
    [
      ...DISPLAY_UTILITIES.filter((name) => !STATIC_UTILITIES.includes(name)),
      ...Object.keys(VISIBILITY),
    ],
    STATIC_DECLS,
  );
}
