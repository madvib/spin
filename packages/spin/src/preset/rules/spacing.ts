import type { Rule } from "@unocss/core";
import { staticRules } from "../utils/factories.ts";
import { spacingRule } from "../utils/factories.ts";

/**
 * The margin axes that accept `auto`, with the properties each one sets.
 *
 * `auto` is a keyword, not a scale step, so it is the one margin value that
 * does not resolve from the theme. It is legal on margins and meaningless on
 * padding or gap, which is why this table is its own list rather than a flag
 * on the spacing axes: `p-auto` must not resolve.
 */
export const AUTO_AXES: ReadonlyArray<readonly [string, string]> = [
  ["m-auto", "margin"],
  ["mx-auto", "margin-left|margin-right"],
  ["my-auto", "margin-top|margin-bottom"],
  ["mt-auto", "margin-top"],
  ["mr-auto", "margin-right"],
  ["mb-auto", "margin-bottom"],
  ["ml-auto", "margin-left"],
  ["me-auto", "margin-inline-end"],
  ["ms-auto", "margin-inline-start"],
];

/** The `auto` margin names, for the catalog. */
export const MARGIN_AUTO_NAMES: readonly string[] = AUTO_AXES.map(([name]) =>
  name
);

export function spacingRules(): Rule[] {
  return [
    spacingRule(/^p-(.+)$/, ["padding"], "p-$spacing"),
    spacingRule(/^m-(.+)$/, ["margin"], "m-$spacing"),
    // `auto` on every margin axis. Declared, not resolved: it is a keyword.
    ...staticRules(
      AUTO_AXES.map(([name]): string => name),
      Object.fromEntries(
        AUTO_AXES.map(([name, props]) => [
          name,
          Object.fromEntries(props.split("|").map((p) => [p, "auto"])),
        ]),
      ),
    ),

    spacingRule(
      /^mx-(.+)$/,
      ["margin-left", "margin-right"],
      "m-$spacing",
    ),
    spacingRule(
      /^my-(.+)$/,
      ["margin-top", "margin-bottom"],
      "m-$spacing",
    ),
    spacingRule(/^mt-(.+)$/, ["margin-top"], "m-$spacing"),
    spacingRule(/^mr-(.+)$/, ["margin-right"], "m-$spacing"),
    spacingRule(/^mb-(.+)$/, ["margin-bottom"], "m-$spacing"),
    spacingRule(/^ml-(.+)$/, ["margin-left"], "m-$spacing"),

    // Logical insets: `me`/`ms` are the inline-end and inline-start margins,
    // `ps`/`pe` the inline-start and inline-end padding, so a component
    // flips with the writing mode instead of against it.
    spacingRule(/^me-(.+)$/, ["margin-inline-end"], "m-$spacing"),
    spacingRule(/^ms-(.+)$/, ["margin-inline-start"], "m-$spacing"),
    spacingRule(/^ps-(.+)$/, ["padding-inline-start"], "p-$spacing"),
    spacingRule(/^pe-(.+)$/, ["padding-inline-end"], "p-$spacing"),
    spacingRule(
      /^px-(.+)$/,
      ["padding-left", "padding-right"],
      "p-$spacing",
    ),
    spacingRule(
      /^py-(.+)$/,
      ["padding-top", "padding-bottom"],
      "p-$spacing",
    ),
    spacingRule(/^pt-(.+)$/, ["padding-top"], "p-$spacing"),
    spacingRule(/^pr-(.+)$/, ["padding-right"], "p-$spacing"),
    spacingRule(/^pb-(.+)$/, ["padding-bottom"], "p-$spacing"),
    spacingRule(/^pl-(.+)$/, ["padding-left"], "p-$spacing"),
    // `gap-gutter` is the one gap that is not a scale step: it reads the
    // container's own spacing, so a page's grid and its container cannot drift
    // apart the way `gap-4` and `p-4` can.
    //
    // Static, because the name is a literal multi-word token that uno's
    // extractor does not produce as a candidate — a regex rule for it never
    // runs, however it is written. And the value is a custom property the
    // CONSUMER sets on the container, not a theme token: a grid's gutter is a
    // property of that grid, which is why `grid.ts` says the same thing.
    ...gutterRules(),
    spacingRule(/^gap-(.+)$/, ["gap"], "gap-$spacing"),
    spacingRule(/^gap-x-(.+)$/, ["column-gap"], "gap-$spacing"),
    spacingRule(/^gap-y-(.+)$/, ["row-gap"], "gap-$spacing"),
  ];
}

/**
 * The gutter.
 *
 * One per axis, all stating the same custom property. `--grid-gutter` is set
 * by the consumer on the container rather than read from the theme, because a
 * grid's gutter belongs to that grid: two grids on one page have different
 * gaps, and a theme scale would force them to be the same.
 */
export const GUTTER_AXES: ReadonlyArray<
  readonly [name: string, property: string]
> = [
  ["gap-gutter", "gap"],
  ["gap-x-gutter", "column-gap"],
  ["gap-y-gutter", "row-gap"],
];

/** The gutter names, for the catalog. */
export const GUTTER_NAMES: readonly string[] = GUTTER_AXES.map(([name]) =>
  name
);

function gutterRules(): Rule[] {
  return GUTTER_AXES.map(([name, property]): Rule => [
    name,
    { [property]: "var(--grid-gutter)" },
  ]);
}
