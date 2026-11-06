import type { SpinRule } from "../../utils/lookup.ts";

/**
 * Swatch — a small color dot/box painted from a `--swatch` CSS variable.
 *
 * The primitive owns shape, border and sizing only; the caller paints it by
 * setting `--swatch` (e.g. `style="--swatch: #3b82f6"` or a utility). There
 * is no tone of its own — the colour is the data, not a variant.
 */
export function swatchRules(
  roots: readonly string[],
): SpinRule[] {
  if (!roots.includes("swatch")) return [];
  const base = "swatch";
  return [swatchBase(base), ...swatchSizes(base)];
}

function swatchBase(base: string): SpinRule {
  return [
    /^swatch$/,
    function* (_m, ctx) {
      const borderWidth = ctx?.theme?.border?.width;
      const borderColor = ctx?.theme?.color?.border;
      const radius = ctx?.theme?.radius?.sm;
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

function swatchSizes(base: string): SpinRule[] {
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
