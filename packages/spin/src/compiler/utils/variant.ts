import type { Variant } from "@unocss/core";
import type { Theme } from "../../theme/theme-types.d.ts";

export function prefixVariant(
  name: string,
  prefix: string,
  selector: (s: string) => string,
): Variant<Theme> {
  return {
    name,
    match(matcher: string) {
      if (!matcher.startsWith(prefix)) return matcher;
      return { matcher: matcher.slice(prefix.length), selector };
    },
  } as Variant<Theme>;
}
