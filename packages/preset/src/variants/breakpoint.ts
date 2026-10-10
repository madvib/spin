import type { Variant } from "@unocss/core";
import { groupOf, type ThemeContext } from "../utils/lookup.ts";

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
 *
 * A breakpoint the theme does not declare is not a prefix, so `md:` emits
 * nothing rather than guessing an edge.
 */
/**
 * A media query can only spend a LITERAL: `var()` inside `@media` is not
 * resolved at parse time, so lightningcss rejects the whole stylesheet. Uno
 * hands the theme's breakpoints to rules already var-wrapped
 * (`var(--breakpoint-sm)`), so the wrapper is stripped back to the token's
 * literal value wherever one is recoverable. A token that never had one
 * (a var with no unwrap point) is not a media edge.
 */
function mediaEdge(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const wrapped = /^var\(--breakpoint-([a-z]+)\)$/.exec(value);
  if (!wrapped) return value;
  return LITERAL_EDGES[wrapped[1]!];
}

const LITERAL_EDGES: Record<string, string> = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
};

export function breakpointVariant(): Variant {
  return {
    name: "spin-breakpoint",
    match(matcher: string, ctx?: ThemeContext) {
      const max = matcher.startsWith("max-");
      const rest = max ? matcher.slice(4) : matcher;
      const colon = rest.indexOf(":");
      if (colon === -1) return matcher;
      const name = rest.slice(0, colon);
      const edge = mediaEdge(groupOf(ctx, "breakpoint")[name]);
      if (edge === undefined) return matcher;
      return {
        matcher: rest.slice(colon + 1),
        handle: (input, next) => {
          // The parent goes on the result, not the input: `next` transforms the
          // context and does not carry an override parent through.
          const result = next(input);
          return {
            ...result,
            parent: `@media ${max ? "not all and " : "all and "}(min-width: ${edge})`,
          };
        },
      };
    },
  } as Variant;
}
