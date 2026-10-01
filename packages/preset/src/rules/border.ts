import type { Rule } from "@unocss/core";
import type { SpinSets } from "../sets.ts";
import {
  BORDER_SIDES,
  BORDER_STYLES,
  BORDER_WIDTHS,
} from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export function borderRules(_sets: SpinSets): Rule[] {
  return [
    ...staticRules([...Object.keys(BORDER_STYLES)], STATIC_DECLS),
    [
      /^border(?:-([trbl]))?(?:-(0|2|4|8))?$/,
      ([, side, width]: string[]) => {
        if (side === undefined && width === undefined) {
          return { "border-width": BORDER_WIDTHS[""] };
        }
        const prop = BORDER_SIDES[side ?? ""];
        const value = BORDER_WIDTHS[width ?? ""];
        if (!prop || !value) return undefined;
        return { [prop]: value };
      },
      { autocomplete: "border-(t|r|b|l)-(0|2|4|8)" },
    ],
  ];
}
