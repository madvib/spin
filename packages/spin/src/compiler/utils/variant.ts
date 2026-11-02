import type { Variant } from "@unocss/core";

export function prefixVariant(
  name: string,
  prefix: string,
  selector: (s: string) => string,
): Variant {
  return {
    name,
    match(matcher: string) {
      if (!matcher.startsWith(prefix)) return matcher;
      return { matcher: matcher.slice(prefix.length), selector };
    },
  } as Variant;
}
