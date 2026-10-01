import type { Rule } from "@unocss/core";
import type { SpinSets } from "../sets.ts";
import {
  TEXT_ALIGN,
  TEXT_DECORATION,
  WHITESPACE,
  WORD_BREAK,
} from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export function textRules(_sets: SpinSets): Rule[] {
  return staticRules(
    [
      ...Object.keys(TEXT_ALIGN),
      ...Object.keys(TEXT_DECORATION),
      ...Object.keys(WHITESPACE),
      ...Object.keys(WORD_BREAK),
    ],
    STATIC_DECLS,
  );
}
