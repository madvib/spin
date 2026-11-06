import type { Variant } from "@unocss/core";
import type { Theme } from "../../theme/theme-types.d.ts";
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
export function spinVariants(
  options: { readonly breakpoints?: Readonly<Record<string, string>> } = {},
): Variant<Theme>[] {
  return [
    hoverVariant,
    focusVariant,
    breakpointVariant(options.breakpoints ?? {}),
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

/**
 * The theme's breakpoints as literal widths, the first declaration winning.
 *
 * A media query cannot carry a custom property, so the responsive variant
 * needs the VALUE — and every theme in one stylesheet declares its own, so
 * the first document states the edges the whole sheet uses.
 */
export function breakpointEdges(
  trees: readonly import("../../theme/index.ts").TokenTree[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tree of trees) {
    const walk = (node: import("../../theme/index.ts").TokenNode): void => {
      if (node.kind === "group") {
        for (const child of node.children) walk(child);
        return;
      }
      if (node.path[0] !== "breakpoint") return;
      const name = node.path[1];
      if (name === undefined || name in out) return;
      if (typeof node.value === "string") out[name] = node.value;
    };
    for (const root of tree) walk(root);
  }
  return out;
}
