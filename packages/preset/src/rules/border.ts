import type { Rule } from "@unocss/core";
import {
  BORDER_SIDES,
  BORDER_STYLES,
  BORDER_WIDTHS,
} from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export const BORDER_STYLE_NAMES: readonly string[] = Object.keys(BORDER_STYLES);
/**
 * The side and width alternatives, read from the tables the rule resolves
 * against. Hand-written alternations drift — `border-b` went missing from one
 * exactly this way while `BORDER_SIDES` carried `b` the whole time — so the
 * pattern cannot be spelled out by hand here.
 */
const SIDE_ALTERNATION = Object.keys(BORDER_SIDES).filter((side) => side !== "")
  .join("");
const WIDTH_ALTERNATION = Object.keys(BORDER_WIDTHS)
  .filter((width) => width !== "")
  .join("|");

/** `border`, `border-b`, `border-t-2`: every side the tables declare. */
export const BORDER_SIDE_PATTERN = new RegExp(
  `^border(?:-([${SIDE_ALTERNATION}]))?(?:-(${WIDTH_ALTERNATION}))?$`,
);

/** The side names the pattern accepts, for the catalog. */
export const BORDER_SIDE_NAMES: readonly string[] = Object.keys(BORDER_SIDES)
  .filter((side) => side !== "")
  .map((side) => `border-${side}`);

/**
 * Border widths and styles: the names the catalog lists. Sides are derived
 * from the same table the rule matches against, so a side cannot be advertised
 * without generating.
 */
export const BORDER_NAMES: readonly string[] = [
  ...Object.keys(BORDER_WIDTHS).map((width) =>
    `border${width ? `-${width}` : ""}`
  ),
  ...BORDER_STYLE_NAMES,
  ...BORDER_SIDE_NAMES,
];

export function borderRules(): Rule[] {
  return [
    ...staticRules([...BORDER_STYLE_NAMES], STATIC_DECLS),
    [
      BORDER_SIDE_PATTERN,
      ([, side, width]: string[]) => {
        if (side === undefined && width === undefined) {
          return { "border-width": BORDER_WIDTHS[""] };
        }
        const prop = BORDER_SIDES[side ?? ""];
        const value = BORDER_WIDTHS[width ?? ""];
        if (!prop || !value) return undefined;
        return { [prop]: value };
      },
      { autocomplete: `border-(${SIDE_ALTERNATION})-(0|2|4|8)` },
    ],
  ];
}
