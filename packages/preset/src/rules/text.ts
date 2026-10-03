import type { Rule } from "@unocss/core";
import {
  LIST_STYLE,
  TEXT_ALIGN,
  TEXT_DECORATION,
  WHITESPACE,
  WORD_BREAK,
} from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export function textRules(): Rule[] {
  return staticRules(
    [
      ...Object.keys(TEXT_ALIGN),
      ...Object.keys(TEXT_DECORATION),
      ...Object.keys(WHITESPACE),
      ...Object.keys(WORD_BREAK),
      ...Object.keys(LIST_STYLE),
    ],
    STATIC_DECLS,
  );
}
