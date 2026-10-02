import type { Rule } from "@unocss/core";
import {
  BORDER_SIDES,
  BORDER_STYLES,
  BORDER_WIDTHS,
} from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export function borderRules(): Rule[] {
  return [
    ...staticRules([...Object.keys(BORDER_STYLES)], STATIC_DECLS),
    [
      /^border(?:-([xystrel]))?(?:-(0|2|4|8))?$/,
      ([, side, width]: string[]) => {
        if (side === undefined && width === undefined) {
          return { "border-width": BORDER_WIDTHS[""] };
        }
        const prop = BORDER_SIDES[side ?? ""];
        const value = BORDER_WIDTHS[width ?? ""];
        if (!prop || !value) return undefined;
        return { [prop]: value };
      },
      { autocomplete: "border-(t|r|b|l|x|y|s|e)-(0|2|4|8)" },
    ],
  ];
}
