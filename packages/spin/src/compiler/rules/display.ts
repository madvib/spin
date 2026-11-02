import type { Rule } from "@unocss/core";
import {
  BACKDROP_BLUR,
  DISPLAY_VALUES,
  STATIC_UTILITIES,
  VISIBILITY,
} from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export const DISPLAY_NAMES: readonly string[] = Object.keys(DISPLAY_VALUES);
export const VISIBILITY_NAMES: readonly string[] = Object.keys(VISIBILITY);
export const BACKDROP_BLUR_NAMES: readonly string[] = Object.keys(BACKDROP_BLUR);

export function displayRules(): Rule[] {
  return staticRules(
    [
      ...DISPLAY_NAMES.filter(
        (name) => !(STATIC_UTILITIES as readonly string[]).includes(name),
      ),
      ...VISIBILITY_NAMES,
      ...BACKDROP_BLUR_NAMES,
    ],
    STATIC_DECLS,
  );
}
