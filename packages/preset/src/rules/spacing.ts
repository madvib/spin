import type { Rule } from "@unocss/core";
import { staticRules } from "../utils/factories.ts";
import { spacingRule } from "../utils/factories.ts";

export function spacingRules(): Rule[] {
  return [
    spacingRule(/^p-(.+)$/, ["padding"], "p-$spacing"),
    spacingRule(/^m-(.+)$/, ["margin"], "m-$spacing"),
    // `mx-auto` is the one mx that is not a scale step: `auto` is a keyword,
    // not a token, so it is declared rather than resolved.
    ...staticRules(["mx-auto"], MX_AUTO_DECLS),

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
    // container's own rhythm, so a page's grid and its container cannot drift
    // apart the way `gap-4` and `p-4` can.
    ...staticRules(
      ["gap-gutter", "gap-x-gutter", "gap-y-gutter"],
      GUTTER_DECLS,
    ),
    spacingRule(/^gap-(.+)$/, ["gap"], "gap-$spacing"),
    spacingRule(/^gap-x-(.+)$/, ["column-gap"], "gap-$spacing"),
    spacingRule(/^gap-y-(.+)$/, ["row-gap"], "gap-$spacing"),
  ];
}

const GUTTER_DECLS: Record<string, Record<string, string>> = {
  "gap-gutter": { gap: "var(--grid-gutter)" },
  "gap-x-gutter": { "column-gap": "var(--grid-gutter)" },
  "gap-y-gutter": { "row-gap": "var(--grid-gutter)" },
};

const MX_AUTO_DECLS: Record<string, Record<string, string>> = {
  "mx-auto": { "margin-left": "auto", "margin-right": "auto" },
};
