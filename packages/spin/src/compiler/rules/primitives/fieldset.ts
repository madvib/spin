import type { Rule } from "@unocss/core";
import { claim, type Mode } from "./shared.ts";
import { token } from "../../utils/lookup.ts";

/**
 * Fieldset & legend — the bare grouping element and its title.
 *
 * A fieldset groups related fields; the legend reads as the group's name.
 * The platform gives the fieldset a default border and the legend a default
 * position inside it, but neither is styled to match the design system —
 * the border is the browser's inset grey, the legend has no padding to lift
 * it off the border, and the box has no radius or spacing.
 *
 * The rule spends the same box tokens the field box spends — border width,
 * border colour, radius, spacing — so a fieldset looks like the controls it
 * groups. The legend is an inline title: it sits on the border with padding
 * on either side, at the field's type weight, so it reads as a label for the
 * group rather than a stray word inside it.
 *
 * A theme that omits a token gets no declaration rather than a fallback the
 * theme did not choose — the drop-missing pattern every primitive follows.
 */
export function fieldsetRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("fieldset")) return [];
  return [fieldsetRule(mode)];
}

function fieldsetRule(mode: Mode): Rule {
  const fieldset = claim(mode, "fieldset");
  const legend = claim(mode, "legend");
  return [
    /^fieldset$/,
    function* (_m, ctx) {
      const box: Record<string, string | undefined> = {
        display: "flex",
        "flex-direction": "column",
        // Children fill the measure: a shrink-wrapped label beside a
        // full-width box reads as content escaping its group.
        "align-items": "stretch",
      };
      if (token(ctx, "spacing.4") !== undefined) {
        Object.assign(box, { padding: token(ctx, "spacing.4") });
      }
      if (token(ctx, "radius.md") !== undefined) {
        Object.assign(box, { "border-radius": token(ctx, "radius.md") });
      }
      if (
        token(ctx, "border.width") !== undefined &&
        token(ctx, "color.border") !== undefined
      ) {
        Object.assign(box, {
          border: `${token(ctx, "border.width")} solid ${
            token(ctx, "color.border")
          }`,
        });
      }
      yield {
        [ctx.symbols.selector]: () => fieldset,
        ...box,
      };

      // The legend sits on the border: padding-inline lifts it clear of the
      // edge, and the type weight makes it read as the group's name.
      yield {
        [ctx.symbols.selector]: () => `${fieldset} > ${legend}`,
        ...(token(ctx, "spacing.2") !== undefined
          ? { "padding-inline": token(ctx, "spacing.2") }
          : {}),
        ...(token(ctx, "font.size.sm") !== undefined
          ? { "font-size": token(ctx, "font.size.sm") }
          : {}),
        ...(token(ctx, "font.weight.semibold") !== undefined
          ? { "font-weight": token(ctx, "font.weight.semibold") }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "fieldset" },
  ];
}
