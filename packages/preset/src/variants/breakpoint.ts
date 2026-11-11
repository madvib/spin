import type { Variant } from "@unocss/core";
import type { Theme } from "@spinjs/theme/theme-types";

/**
 * Responsive prefixes, resolved against the theme's own breakpoint tokens.
 *
 * A theme declares `breakpoint.md: 48rem` and gets `md:` — the same names it
 * would get as a scale, because it is a scale. The media query carries the
 * token's VALUE, not its custom property: `var()` is not valid in a media
 * query, so an emitting variant produced `(min-width: var(--breakpoint-md))`
 * and every responsive rule silently never matched.
 *
 * `max-` inverts the query rather than adding a second vocabulary: an author
 * who writes `max-md:` is expressing the same token with an opposite edge, and
 * inventing `tablet-down:` for that would be a synonym the lint would have to
 * learn.
 *
 * A breakpoint the theme does not declare is not a prefix, so `md:` emits
 * nothing rather than guessing an edge.
 */
export function breakpointVariant(
  edges: Readonly<Record<string, string>>,
): Variant<Theme> {
  return {
    name: "spin-breakpoint",
    match(matcher: string) {
      const max = matcher.startsWith("max-");
      const rest = max ? matcher.slice(4) : matcher;
      const colon = rest.indexOf(":");
      if (colon === -1) return matcher;
      const name = rest.slice(0, colon);
      const edge = edges[name];
      if (edge === undefined) return matcher;
      return {
        matcher: rest.slice(colon + 1),
        handle: (input, next) => {
          // The parent goes on the result, not the input: `next` transforms the
          // context and does not carry an override parent through.
          const result = next(input);
          return {
            ...result,
            // The `@media` keyword is part of the parent, not Uno's: a
            // parent without it is emitted verbatim as a selector, and the
            // stylesheet carries `all and (min-width: 48rem){` — an invalid
            // rule the browser drops whole.
            parent: `@media ${
              max ? "not all and " : "all and "
            }(min-width: ${edge})`,
          };
        },
      };
    },
  } as Variant<Theme>;
}
