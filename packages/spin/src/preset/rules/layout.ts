import type { Rule } from "@unocss/core";
import {
  FLEX_UTILITIES,
  ORDER_UTILITIES,
  STATIC_UTILITIES,
} from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export const LAYOUT_NAMES: readonly string[] = [
  ...STATIC_UTILITIES,
  ...FLEX_UTILITIES,
  ...ORDER_UTILITIES,
];

export function layoutRules(): Rule[] {
  return staticRules(LAYOUT_NAMES, STATIC_DECLS);
}
