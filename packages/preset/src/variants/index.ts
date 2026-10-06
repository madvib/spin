import type { Variant } from "@unocss/core";
import { FOCUS_PREFIX, focusVariant } from "./focus.ts";
import { HOVER_PREFIX, hoverVariant } from "./hover.ts";
import { breakpointVariant } from "./breakpoint.ts";

/**
 * Interaction states and responsive edges — the axes a single element can
 * respond on.
 *
 * Motion is deliberately absent. `dark:` was here and was removed: a dark
 * theme is a different theme that declares its own tokens, so a utility that
 * only applies in dark mode is a theme patch wearing a utility's clothes. It
 * says "your theme is incomplete" while appearing to fix it. Breakpoints are
 * the opposite case — they are a scale the theme already declares, so
 * `md:` is the same vocabulary as `p-4`, not a second way to say it.
 */
export function spinVariants(): Variant[] {
  return [
    hoverVariant,
    focusVariant,
    breakpointVariant(),
  ];
}

/**
 * The fixed variant prefixes the preset defines.
 *
 * `hover:` and `focus:` are literal, so they can be listed. The breakpoint
 * prefixes are the theme's own scale (`md:`, `lg:`, …), so they are not
 * listed here — the catalog reads them from the theme.
 */
export function variantPrefixes(): string[] {
  return [HOVER_PREFIX, FOCUS_PREFIX];
}
