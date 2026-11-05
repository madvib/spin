import type { Rule } from "@unocss/core";

import { token } from "../../utils/lookup.ts";
import { ladder, styleType } from "./shared.ts";

/**
 * The hover chip: a one-line note that floats beside its control.
 *
 * Hidden at rest and small by construction — a tooltip that paints itself at
 * body size in the flow is the failure this rule exists to prevent. Position
 * comes from the caller (the chip floats beside whatever anchors it), and
 * reveal comes from the caller's hover utilities; the rule only guarantees
 * the chip never shows up uninvited and never reads as body copy.
 *
 * The reads are narrow on purpose: the derivation records every token the
 * rule touches, so a shared helper would file sizes the chip never sets.
 */
function tooltipRule(): Rule {
  return [
    /^tooltip$/,
    function* (_m, ctx) {
      // The chip reads the caption voice — small print, never body copy —
      // with the ladder step that style is built from as the window fallback.
      const caption = styleType(ctx, "caption");
      const sizeXs = caption.size ?? ladder(ctx, "font.size.xs");
      const text = token(ctx, "color.text");
      const raised = token(ctx, "color.surface-raised");
      const borderWidth = token(ctx, "border.width");
      const border = token(ctx, "color.border");
      const radiusSm = token(ctx, "radius.sm");
      const stack = token(ctx, "z-index.dropdown");
      const spacing1 = token(ctx, "spacing.1");
      const spacing2 = token(ctx, "spacing.2");
      yield {
        [ctx.symbols.selector]: () => "tooltip",
        visibility: "hidden",
        position: "absolute",
        ...(stack !== undefined ? { "z-index": stack } : {}),
        ...(sizeXs !== undefined ? { "font-size": sizeXs } : {}),
        ...(text !== undefined ? { color: text } : {}),
        ...(raised !== undefined ? { "background-color": raised } : {}),
        ...(borderWidth !== undefined && border !== undefined
          ? { border: `${borderWidth} solid ${border}` }
          : {}),
        ...(radiusSm !== undefined ? { "border-radius": radiusSm } : {}),
        ...(spacing1 !== undefined && spacing2 !== undefined
          ? { padding: `${spacing1} ${spacing2}` }
          : {}),
        overflow: "hidden",
        "max-width": "16rem",
      };
      // An open popover is showing by definition: the platform's open
      // state wins over the resting hide, or the measured component
      // grounds correctly and paints nothing.
      yield {
        [ctx.symbols.selector]: () => `${"tooltip"}:popover-open`,
        visibility: "visible",
      };
    },
    { layer: "primitives", autocomplete: "tooltip" },
  ];
}

export function tooltipRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("tooltip")) return [];
  return [tooltipRule()];
}
