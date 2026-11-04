import type { Rule } from "@unocss/core";
import {
  LEADING,
  LIST_STYLE,
  TEXT_ALIGN,
  TEXT_DECORATION,
  WHITESPACE,
  WORD_BREAK,
} from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export const TEXT_ALIGN_NAMES: readonly string[] = Object.keys(TEXT_ALIGN);
export const TEXT_DECORATION_NAMES: readonly string[] = Object.keys(
  TEXT_DECORATION,
);
export const WHITESPACE_NAMES: readonly string[] = Object.keys(WHITESPACE);
export const WORD_BREAK_NAMES: readonly string[] = Object.keys(WORD_BREAK);

export const TEXT_NAMES: readonly string[] = [
  ...TEXT_ALIGN_NAMES,
  ...TEXT_DECORATION_NAMES,
  ...WHITESPACE_NAMES,
  ...WORD_BREAK_NAMES,
  ...Object.keys(LIST_STYLE),
  ...Object.keys(LEADING),
];

export function textRules(): Rule[] {
  return staticRules([...TEXT_NAMES], STATIC_DECLS);
}
