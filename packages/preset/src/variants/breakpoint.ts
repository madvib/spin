import type { Variant } from "@unocss/core";
import { cssVarName } from "@spin/theme";
import type { SpinSets } from "../sets.ts";

/**
 * Responsive prefixes, resolved against the theme's own breakpoint tokens.
 *
 * A theme declares `breakpoint.md: 48rem` and gets `md:` — the same names it
 * would get as a scale, because it is a scale. The media query spends the
 * token rather than a literal, so a theme that moves a breakpoint moves every
 * responsive utility with it, and the stylesheet stays theme-agnostic.
 *
 * `max-` inverts the query rather than adding a second vocabulary: an author
 * who writes `max-md:` is expressing the same token with an opposite edge, and
 * inventing `tablet-down:` for that would be a synonym the lint would have to
 * learn.
 */
export function breakpointVariant(sets: SpinSets): Variant {
  const names = new Set(sets.breakpoint.keys());
  return {
    name: "spin-breakpoint",
    match(matcher: string) {
      const max = matcher.startsWith("max-");
      const rest = max ? matcher.slice(4) : matcher;
      const colon = rest.indexOf(":");
      if (colon === -1) return matcher;
      const name = rest.slice(0, colon);
      if (!names.has(name)) return matcher;
      const path = sets.breakpoint.get(name);
      if (path === undefined) return matcher;
      const edge = `var(${cssVarName(path)})`;
      return {
        matcher: rest.slice(colon + 1),
        handle: (input, next) => {
          // The parent goes on the result, not the input: `next` transforms the
          // context and does not carry an override parent through.
          const result = next(input);
          return {
            ...result,
            parent: `${max ? "not all and " : "all and "}(min-width: ${edge})`,
          };
        },
      };
    },
  } as Variant;
}
