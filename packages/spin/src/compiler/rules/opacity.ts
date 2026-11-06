import { baseTheme } from "../../theme/themes/index.ts";
import type { SpinRule } from "../utils/lookup.ts";
import { named, type ThemeContext } from "../utils/lookup.ts";

/**
 * Baseline opacity steps, read directly from `baseTheme.opacity` in DTCG so
 * the theme package is the single source of truth while exact-name rules
 * outrank wind4's dynamic `opacity-*` pattern and carry the baseline fraction
 * as a `var()` fallback when a minimal theme omits `opacity`.
 */
const BASE_OPACITY: ReadonlyArray<readonly [step: string, fallback: string]> =
  Object.entries(
    (baseTheme["opacity"] ?? {}) as Record<string, { $value?: unknown }>,
  )
    .filter(([key, node]) => !key.startsWith("$") && node?.$value !== undefined)
    .map(([step, node]) => [step, String(node.$value)] as const);

export function opacityRules(): SpinRule[] {
  return [
    ...BASE_OPACITY.map(([step, fallback]): SpinRule => [
      `opacity-${step}`,
      {
        opacity: `var(--opacity-${step}, ${fallback})`,
      },
    ]),
    [
      /^opacity-(.+)$/,
      ([, step]: string[], ctx?: ThemeContext) => {
        const token = named(ctx, "opacity", step);
        if (token) return { opacity: token };
        return undefined;
      },
      { autocomplete: "opacity-$opacity" },
    ],
  ];
}
