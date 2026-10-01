import type { Variant } from "@unocss/core";
import { focusVariant } from "./focus.ts";
import { hoverVariant } from "./hover.ts";
import { breakpointVariant } from "./breakpoint.ts";
import type { SpinSets } from "../sets.ts";

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
export function spinVariants(sets: SpinSets): Variant[] {
  return [
    hoverVariant,
    focusVariant,
    breakpointVariant(sets),
  ];
}
