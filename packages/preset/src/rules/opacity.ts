import type { SpinRule } from "../utils/lookup.ts";
import { named, type ThemeContext } from "../utils/lookup.ts";

/**
 * The opacity steps a theme declares, as exact-name rules over the dynamic
 * catch-all.
 *
 * Exact names outrank wind4's dynamic `opacity-*` pattern; a dynamic rule
 * alone loses the race and `opacity-50` resolves to wind4's `50%` instead
 * of the theme's step. The steps come from the caller's merged theme at
 * preset construction — never a module-load table — and carry no fallback
 * literal: a step the theme declares resolves, anything else falls through.
 */
export function opacityRules(steps: readonly string[] = []): SpinRule[] {
  return [
    ...steps.map((step): SpinRule => [
      `opacity-${step}`,
      { opacity: `var(--opacity-${step})` },
    ]),
    [
      /^opacity-(.+)$/,
      ([, step]: string[], ctx?: ThemeContext) => {
        // Dynamic: step comes from the class name.
        const token = named(ctx, "opacity", step);
        if (token) return { opacity: token };
        return undefined;
      },
      { autocomplete: "opacity-$opacity" },
    ],
  ];
}
