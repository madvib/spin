import type { Rule } from "@unocss/core";
import { token } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Swatch — a small color dot/box painted from a `--swatch` CSS variable.
 *
 * The primitive owns shape, border and sizing only; the caller paints it by
 * setting `--swatch` (e.g. `style="--swatch: #3b82f6"` or a utility). There
 * is no tone of its own — the colour is the data, not a variant.
 */
export function swatchRules(
  roots: readonly string[],
  mode: Mode,
): Rule[] {
  if (!roots.includes("swatch")) return [];
  const base = claim(mode, "swatch");
  return [swatchBase(base), ...swatchSizes(base)];
}

function swatchBase(base: string): Rule {
  return [
    /^swatch$/,
    function* (_m, ctx) {
      const borderWidth = token(ctx, "border.width");
      const borderColor = token(ctx, "color.border");
      const radius = token(ctx, "radius.sm");
      yield {
        [ctx.symbols.selector]: () => base,
        display: "inline-block",
        width: "1rem",
        height: "1rem",
        ...(borderWidth !== undefined && borderColor !== undefined
          ? { border: `${borderWidth} solid ${borderColor}` }
          : {}),
        ...(radius !== undefined ? { "border-radius": radius } : {}),
        background: "var(--swatch)",
      };
      yield {
        [ctx.symbols.selector]: () => `${base}.s-sm`,
        width: "0.75rem",
        height: "0.75rem",
      };
      yield {
        [ctx.symbols.selector]: () => `${base}.s-md`,
        width: "1rem",
        height: "1rem",
      };
      yield {
        [ctx.symbols.selector]: () => `${base}.s-lg`,
        width: "1.5rem",
        height: "1.5rem",
      };
    },
    { layer: "primitives", autocomplete: "swatch" },
  ];
}

function swatchSizes(base: string): Rule[] {
  return [
    [
      /^s-md$/,
      function* (_m, ctx) {
        yield {
          [ctx.symbols.selector]: () => `${base}.s-md`,
          width: "1rem",
          height: "1rem",
        };
      },
      { layer: "primitives", autocomplete: "s-md" },
    ],
  ];
}
