import type { SpinRule } from "../utils/lookup.ts";
import {
  FONT_STYLE,
  LIST_STYLE,
  TEXT_ALIGN,
  TEXT_DECORATION,
  TRUNCATE,
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
export const FONT_STYLE_NAMES: readonly string[] = Object.keys(FONT_STYLE);
export const TRUNCATE_NAMES: readonly string[] = Object.keys(TRUNCATE);

export const TEXT_NAMES: readonly string[] = [
  ...TEXT_ALIGN_NAMES,
  ...TEXT_DECORATION_NAMES,
  ...FONT_STYLE_NAMES,
  ...TRUNCATE_NAMES,
  ...WHITESPACE_NAMES,
  ...WORD_BREAK_NAMES,
  ...Object.keys(LIST_STYLE),
];

export function textRules(): SpinRule[] {
  return staticRules([...TEXT_NAMES], STATIC_DECLS);
}
