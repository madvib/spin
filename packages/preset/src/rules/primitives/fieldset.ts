import type { Rule } from "@unocss/core";
import { claim, type Mode } from "./shared.ts";
import { themeOf } from "../../utils/lookup.ts";

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
      const t = themeOf(ctx);
      const box: Record<string, string | undefined> = {
        display: "flex",
        "flex-direction": "column",
      };
      if (t?.spacing?.["2"] !== undefined) {
        Object.assign(box, { gap: t.spacing["2"] });
      }
      if (t?.spacing?.["4"] !== undefined) {
        Object.assign(box, { padding: t.spacing["4"] });
      }
      if (t?.radius?.["md"] !== undefined) {
        Object.assign(box, { "border-radius": t.radius["md"] });
      }
      if (
        t?.borderWidth?.["width"] !== undefined &&
        t?.colors?.["border"] !== undefined
      ) {
        Object.assign(box, {
          border: `${t.borderWidth["width"]} solid ${t.colors["border"]}`,
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
        ...(t?.spacing?.["2"] !== undefined
          ? { "padding-inline": t.spacing["2"] }
          : {}),
        ...(t?.fontSize?.["sm"] !== undefined
          ? { "font-size": t.fontSize["sm"] }
          : {}),
        ...(t?.fontWeight?.["semibold"] !== undefined
          ? { "font-weight": t.fontWeight["semibold"] }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "fieldset" },
  ];
}
