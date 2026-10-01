import type { Rule } from "@unocss/core";
import { staticRules } from "../utils/factories.ts";
import type { SpinSets } from "../sets.ts";
import { spacingRule } from "../utils/factories.ts";

export function spacingRules(sets: SpinSets): Rule[] {
  return [
    spacingRule(sets, /^p-(.+)$/, ["padding"], "p-$spacing"),
    spacingRule(sets, /^m-(.+)$/, ["margin"], "m-$spacing"),
    spacingRule(
      sets,
      /^mx-(.+)$/,
      ["margin-left", "margin-right"],
      "m-$spacing",
    ),
    spacingRule(
      sets,
      /^my-(.+)$/,
      ["margin-top", "margin-bottom"],
      "m-$spacing",
    ),
    spacingRule(sets, /^mt-(.+)$/, ["margin-top"], "m-$spacing"),
    spacingRule(sets, /^mr-(.+)$/, ["margin-right"], "m-$spacing"),
    spacingRule(sets, /^mb-(.+)$/, ["margin-bottom"], "m-$spacing"),
    spacingRule(sets, /^ml-(.+)$/, ["margin-left"], "m-$spacing"),
    spacingRule(
      sets,
      /^px-(.+)$/,
      ["padding-left", "padding-right"],
      "p-$spacing",
    ),
    spacingRule(
      sets,
      /^py-(.+)$/,
      ["padding-top", "padding-bottom"],
      "p-$spacing",
    ),
    spacingRule(sets, /^pt-(.+)$/, ["padding-top"], "p-$spacing"),
    spacingRule(sets, /^pr-(.+)$/, ["padding-right"], "p-$spacing"),
    spacingRule(sets, /^pb-(.+)$/, ["padding-bottom"], "p-$spacing"),
    spacingRule(sets, /^pl-(.+)$/, ["padding-left"], "p-$spacing"),
    // `gap-gutter` is the one gap that is not a scale step: it reads the
    // container's own rhythm, so a page's grid and its container cannot drift
    // apart the way `gap-4` and `p-4` can.
    ...staticRules(
      ["gap-gutter", "gap-x-gutter", "gap-y-gutter"],
      GUTTER_DECLS,
    ),
    spacingRule(sets, /^gap-(.+)$/, ["gap"], "gap-$spacing"),
    spacingRule(sets, /^gap-x-(.+)$/, ["column-gap"], "gap-$spacing"),
    spacingRule(sets, /^gap-y-(.+)$/, ["row-gap"], "gap-$spacing"),
  ];
}

const GUTTER_DECLS: Record<string, Record<string, string>> = {
  "gap-gutter": { gap: "var(--grid-gutter)" },
  "gap-x-gutter": { "column-gap": "var(--grid-gutter)" },
  "gap-y-gutter": { "row-gap": "var(--grid-gutter)" },
};
