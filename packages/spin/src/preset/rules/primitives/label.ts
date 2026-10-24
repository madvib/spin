import type { Rule } from "@unocss/core";
import { claim, type Mode } from "./shared.ts";
import { token } from "../../utils/lookup.ts";

/**
 * Label — the bare `<label>` as a flex row.
 *
 * A label names its control: the input, select or textarea it wraps, and the
 * text that says what it is. The two must sit side by side with a gap between
 * them and be vertically centred — the relationship is spatial, not just
 * semantic, and a block label with inline children gives the browser no way
 * to state it.
 *
 * The rule spends the theme's spacing and type tokens rather than minting
 * numbers: a gap is `spacing-2`, the face is the body face, and a theme that
 * omits either gets no declaration rather than a fallback the theme did not
 * choose. The label inherits the type it sits beside rather than stating a
 * size of its own — the control's box already carries the font-size.
 */
export function labelRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("label")) return [];
  return [labelRule(mode)];
}

function labelRule(mode: Mode): Rule {
  const label = claim(mode, "label");
  return [
    /^label$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => label,
        display: "inline-flex",
        "align-items": "center",
        ...(token(ctx, "spacing.2") !== undefined
          ? { gap: token(ctx, "spacing.2") }
          : {}),
        ...(token(ctx, "font.family.sans") !== undefined
          ? { "font-family": token(ctx, "font.family.sans") }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "label" },
  ];
}
