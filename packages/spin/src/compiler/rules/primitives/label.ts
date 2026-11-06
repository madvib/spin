import type { SpinRule } from "../../utils/lookup.ts";

/**
 * Label — the bare `<label>` as a captioned control.

 * A label names its control: the text that says what it is, above the
 * input, select or textarea it wraps. The caption is the theme's advisory
 * type — small, medium, full ink — because a label that inherits whatever
 * it sits beside reads as a caption in one place and as body in another.
 * The control fills the label's width; the label itself is a block, so it
 * takes the width its parent gives it.
 */
export function labelRules(roots: readonly string[]): SpinRule[] {
  if (!roots.includes("label")) return [];
  return [labelRule()];
}

function labelRule(): SpinRule {
  const label = "label";
  return [
    /^label$/,
    function* (_m, ctx) {
      const primary = ctx?.theme?.element?.label?.type;
      const shared = ctx?.theme?.font?.style?.label;
      const s = primary ?? shared;
      const fontFamily = s?.["font-family"];
      const fontSize = s?.["font-size"];
      const fontWeight = s?.["font-weight"];
      const gap = ctx?.theme?.spacing?.[1];
      const ink = ctx?.theme?.color?.text;
      const checkGap = ctx?.theme?.spacing?.[2];
      yield {
        [ctx.symbols.selector]: () => label,
        display: "flex",
        "flex-direction": "column",
        ...(gap !== undefined ? { gap } : {}),
        ...(fontFamily !== undefined ? { "font-family": fontFamily } : {}),
        ...(fontSize !== undefined ? { "font-size": fontSize } : {}),
        ...(fontWeight !== undefined ? { "font-weight": fontWeight } : {}),
        ...(ink !== undefined ? { color: ink } : {}),
      };
      yield {
        [ctx.symbols.selector]: () =>
          `${label}:has(> input:is([type="checkbox"], [type="radio"]))`,
        "flex-direction": "row",
        "align-items": "center",
        width: "fit-content",
        cursor: "pointer",
        ...(checkGap !== undefined ? { gap: checkGap } : {}),
      };
    },
    { layer: "primitives", autocomplete: "label" },
  ];
}
