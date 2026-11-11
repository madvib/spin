import type { SpinRule } from "../../utils/lookup.ts";

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
export function fieldsetRules(roots: readonly string[]): SpinRule[] {
  if (!roots.includes("fieldset")) return [];
  return [fieldsetRule()];
}

function fieldsetRule(): SpinRule {
  const fieldset = "fieldset";
  const legend = "legend";
  return [
    /^fieldset$/,
    function* (_m, ctx) {
      const padding = ctx?.theme?.spacing?.[4];
      const radius = ctx?.theme?.radius?.md;
      const width = ctx?.theme?.border?.width;
      const edge = ctx?.theme?.color?.border;
      const box: Record<string, string | undefined> = {
        display: "flex",
        "flex-direction": "column",
        // Children fill the measure: a shrink-wrapped label beside a
        // full-width box reads as content escaping its group.
        "align-items": "stretch",
      };
      if (padding !== undefined) {
        Object.assign(box, { padding });
      }
      if (radius !== undefined) {
        Object.assign(box, { "border-radius": radius });
      }
      if (width !== undefined && edge !== undefined) {
        Object.assign(box, {
          border: `${width} solid ${edge}`,
        });
      }
      yield {
        [ctx.symbols.selector]: () => fieldset,
        ...box,
      };

      // The legend sits on the border: padding-inline lifts it clear of the
      // edge, and it wears the label style — the name on a control — so it
      const primary = ctx?.theme?.element?.legend?.type;
      const shared = ctx?.theme?.font?.style?.label;
      const s = primary ?? shared;
      const fontSize = s?.["font-size"];
      const fontWeight = s?.["font-weight"];
      const inset = ctx?.theme?.spacing?.[2];
      yield {
        [ctx.symbols.selector]: () => `${fieldset} > ${legend}`,
        ...(inset !== undefined ? { "padding-inline": inset } : {}),
        ...(fontSize !== undefined ? { "font-size": fontSize } : {}),
        ...(fontWeight !== undefined ? { "font-weight": fontWeight } : {}),
      };
    },
    { layer: "primitives", autocomplete: "fieldset" },
  ];
}
