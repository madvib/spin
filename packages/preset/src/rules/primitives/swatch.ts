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
  return [swatchBase(base)];
}

function swatchBase(root: string): SpinRule {
  return [
    /^swatch$/,
    function* (_m, ctx) {
      const borderWidth = ctx?.theme?.border?.width;
      const borderColor = ctx?.theme?.color?.border;
      const radius = ctx?.theme?.radius?.sm;
      const md = ctx?.theme?.spacing?.[4];
      const sm = ctx?.theme?.spacing?.[3] ?? md;
      const lg = ctx?.theme?.spacing?.[6] ?? md;
      yield {
        [ctx.symbols.selector]: () => root,
        display: "inline-block",
        ...(md !== undefined ? { width: md, height: md } : {}),
        ...(borderWidth !== undefined && borderColor !== undefined
          ? { border: `${borderWidth} solid ${borderColor}` }
          : {}),
        ...(radius !== undefined ? { "border-radius": radius } : {}),
        background: "var(--swatch)",
      };
      if (sm !== undefined) {
        yield {
          [ctx.symbols.selector]: () => `${root}.s-sm`,
          width: sm,
          height: sm,
        };
      }
      if (md !== undefined) {
        yield {
          [ctx.symbols.selector]: () => `${root}.s-md`,
          width: md,
          height: md,
        };
      }
      if (lg !== undefined) {
        yield {
          [ctx.symbols.selector]: () => `${root}.s-lg`,
          width: lg,
          height: lg,
        };
      }
    },
    { layer: "primitives", autocomplete: "swatch" },
  ];
}
