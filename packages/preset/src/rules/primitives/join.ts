import type { Rule } from "@unocss/core";
import { type ThemeContext, token } from "../../utils/lookup.ts";
import type { Mode } from "./shared.ts";

/** Join — adjacent controls merged into one object, by class. */
export function joinRules(
  roots: readonly string[],
  _mode: Mode,
): Rule[] {
  if (!roots.includes("join")) return [];
  return [joinContainer(), joinItem()];
}

/** The theme values join spends: the outer corner and the shared edge. */
function joinTokens(ctx: ThemeContext | undefined) {
  return {
    radius: token(ctx, "radius.md"),
    borderWidth: token(ctx, "border.width"),
  };
}

/**
 * The container. `inline-flex` rather than `flex` because a join sits in a
 * line of markup beside text, and a toolbar that becomes a block has left
 * the sentence it was written into. `stretch` makes the children fill the
 * height, which is what lets a short button meet a taller field with no
 * step between them.
 */
function joinContainer(): Rule {
  return [
    /^join$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => ".join",
        display: "inline-flex",
        "align-items": "stretch",
      };
      // The children's corners go: a field and a button each draw their own,
      // and a joined object has none until an end restores them. Stated on
      // the container's children rather than trusted to the part class, so
      // the reset reaches a child that carries geometry of its own and no
      // class of ours.
      yield {
        [ctx.symbols.selector]: () => ".join > *",
        "border-radius": "0",
      };
    },
    { layer: "primitives", autocomplete: "join" },
  ];
}

/**
 * Each part. Geometry ONLY — the radius and the shared edge. A join-item is
 * usually a bare `<button>`, `<input>` or `<select>`, and those already
 * carry their colours, borders and states from the button and field rules;
 * the join squares the corners those rules draw and never restyles what they
 * paint, so a join of secondaries is still a join of secondaries.
 */
function joinItem(): Rule {
  return [
    /^join-item$/,
    function* (_m, ctx) {
      const t = joinTokens(ctx);
      // Flat everywhere; the two ends below restore their outer corners. The
      // shadow is taken back with the radius: a joined object has ONE edge,
      // and a shadow per child paints a hard offset around every segment —
      // in a neobrut theme, a black box hanging off each side of the seam.
      yield {
        [ctx.symbols.selector]: () => ".join-item",
        "border-radius": "0",
        "box-shadow": "none",
      };
      // The four logical longhands, written per side rather than as a
      // shorthand, because each end restates only its own two corners.
      yield {
        [ctx.symbols.selector]: () => ".join-item:first-child",
        ...(t.radius !== undefined
          ? {
            "border-start-start-radius": t.radius,
            "border-end-start-radius": t.radius,
          }
          : {}),
      };
      yield {
        [ctx.symbols.selector]: () => ".join-item:last-child",
        ...(t.radius !== undefined
          ? {
            "border-start-end-radius": t.radius,
            "border-end-end-radius": t.radius,
          }
          : {}),
      };
      // The seam: overlap the border rather than remove it. Pulling each item
      // after the first back by exactly one border width turns two 1px rules
      // into one, and it stays correct when the theme changes the border
      // weight — which is why it is a negative margin of the token and not a
      // `border: none` on one side. Margin, not positioning, so the layout
      // keeps its own width.
      yield {
        [ctx.symbols.selector]: () => ".join-item + .join-item",
        ...(t.borderWidth !== undefined
          ? { "margin-inline-start": `calc(-1 * ${t.borderWidth})` }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "join-item" },
  ];
}
