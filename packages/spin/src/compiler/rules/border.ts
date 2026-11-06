import { baseTheme } from "../../theme/themes/index.ts";
import { named, type SpinRule, type ThemeContext } from "../utils/lookup.ts";
import { BORDER_SIDES } from "../utils/vocabulary.ts";

const BASE_BORDER_WIDTHS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    (baseTheme["border"] ?? {}) as Record<string, { $value?: unknown }>,
  )
    .filter(([key, node]) => key.startsWith("width") && typeof node?.$value === "string")
    .map(([key, node]) => [key, node.$value as string]),
);

/**
 * The side alternation, read from the table the rule resolves against.
 * Hand-written alternations drift — `border-b` went missing from one exactly
 * this way while `BORDER_SIDES` carried `b` the whole time — so the sides
 * cannot be spelled out by hand here. The widths need no alternation: any
 * number matches, and the theme decides which ones resolve.
 */
const SIDE_ALTERNATION = Object.keys(BORDER_SIDES).filter((side) => side !== "")
  .join("");

/** `border`, `border-b`, `border-t-2`: every side CSS names, at any width. */
export const BORDER_SIDE_PATTERN = new RegExp(
  `^border(?:-([${SIDE_ALTERNATION}]))?(?:-(0|\\d+))?$`,
);

/**
 * Every `border-*` width and style name the theme declares, for the catalog.
 *
 * Widths come from the theme's own `border` family — `width` is the bare
 * `border`, `width-<n>` is `border-<n>` — and named styles from its
 * `border-style-<name>-style` leaves, so a weight or style the theme does
 * not declare is never advertised. Sides are CSS grammar (`border-t` sets
 * `border-top-width` whatever the theme says), so they are always named.
 */
export function borderNames(theme: Record<string, unknown>): string[] {
  const names: string[] = ["border", "border-0"];
  for (const key of Object.keys(theme)) {
    if (key.startsWith("border-width-")) {
      const step = key.slice("border-width-".length);
      if (!names.includes(`border-${step}`)) names.push(`border-${step}`);
    } else if (key.startsWith("border-style-") && key.endsWith("-style")) {
      const name = key.slice("border-style-".length, -"-style".length);
      if (name !== "" && name !== "strong" && !names.includes(`border-${name}`)) {
        names.push(`border-${name}`);
      }
    }
  }
  for (const side of Object.keys(BORDER_SIDES)) {
    if (side !== "") names.push(`border-${side}`);
  }
  return names;
}

export function borderRules(): SpinRule[] {
  return [
    [
      /^border-(solid|dashed|dotted|double|none)$/,
      ([, style]: string[], ctx?: ThemeContext) => {
        if (style === "none") return { "border-style": "none" };
        return {
          "border-style": named(ctx, "border-style", `${style}-style`) ?? style,
        };
      },
      { autocomplete: "border-(solid|dashed|dotted|double|none)" },
    ],
    [
      BORDER_SIDE_PATTERN,
      ([, side, width]: string[], ctx?: ThemeContext) => {
        const prop = BORDER_SIDES[side ?? ""];
        if (!prop) return undefined;
        const borderColor = ctx?.theme?.color?.border;
        if (width === undefined) {
          const resolved = ctx?.theme?.border?.width ?? BASE_BORDER_WIDTHS["width"];
          if (resolved === undefined) return undefined;
          return {
            [prop]: resolved,
            "border-style": "solid",
            ...(borderColor !== undefined ? { "border-color": borderColor } : {}),
          };
        }
        if (width === "0") return { [prop]: "0px" };
        const resolved =
          named(ctx, "border", `width-${width}`) ??
          BASE_BORDER_WIDTHS[`width-${width}`];
        if (resolved === undefined) return undefined;
        return {
          [prop]: resolved,
          "border-style": "solid",
          ...(borderColor !== undefined ? { "border-color": borderColor } : {}),
        };
      },
      { autocomplete: `border-(${SIDE_ALTERNATION})-(0|2|4|8)` },
    ],
  ];
}
