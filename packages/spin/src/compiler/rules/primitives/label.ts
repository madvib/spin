import type { Rule } from "@unocss/core";

import { token } from "../../utils/lookup.ts";
import { ladder, styleType } from "./shared.ts";

/**
 * Label — the bare `<label>` as a captioned control.
 *
 * A label names its control: the text that says what it is, above the
 * input, select or textarea it wraps. The caption is the theme's advisory
 * type — small, medium, full ink — because a label that inherits whatever
 * it sits beside reads as a caption in one place and as body in another.
 * The control fills the label's width; the label itself is a block, so it
 * takes the width its parent gives it.
 */
export function labelRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("label")) return [];
  return [labelRule()];
}

function labelRule(): Rule {
  const label = "label";
  return [
    /^label$/,
    function* (_m, ctx) {
      // The label wears the label voice outright — the name on a control —
      // with the ladder steps the starters build that style from as the
      // window fallback.
      const s = styleType(ctx, "label");
      const fontFamily = s.family ?? ladder(ctx, "font.family.sans");
      const fontSize = s.size ?? ladder(ctx, "font.size.sm");
      const fontWeight = s.weight ?? ladder(ctx, "font.weight.medium");
      yield {
        [ctx.symbols.selector]: () => label,
        display: "flex",
        "flex-direction": "column",
        ...(token(ctx, "spacing.1") !== undefined
          ? { gap: token(ctx, "spacing.1") }
          : {}),
        ...(fontFamily !== undefined ? { "font-family": fontFamily } : {}),
        ...(fontSize !== undefined ? { "font-size": fontSize } : {}),
        ...(fontWeight !== undefined ? { "font-weight": fontWeight } : {}),
        ...(token(ctx, "color.text") !== undefined
          ? { color: token(ctx, "color.text") }
          : {}),
      };
      yield {
        [ctx.symbols.selector]: () =>
          `${label}:has(> input:is([type="checkbox"], [type="radio"]))`,
        "flex-direction": "row",
        "align-items": "center",
        width: "fit-content",
        cursor: "pointer",
        ...(token(ctx, "spacing.2") !== undefined
          ? { gap: token(ctx, "spacing.2") }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "label" },
  ];
}
