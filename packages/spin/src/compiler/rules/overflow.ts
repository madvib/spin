import type { SpinRule } from "../utils/lookup.ts";
import { OVERFLOW_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export const OVERFLOW_NAMES: readonly string[] = OVERFLOW_UTILITIES;

export function overflowRules(): SpinRule[] {
  return staticRules([...OVERFLOW_NAMES], STATIC_DECLS);
}
