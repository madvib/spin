import type { SpinRule } from "../utils/lookup.ts";
import { OVERFLOW_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";

export const OVERFLOW_NAMES: readonly string[] = [
  ...OVERFLOW_UTILITIES,
  "scrollbar-none",
];

export function overflowRules(): SpinRule[] {
  return [
    ...staticRules([...OVERFLOW_UTILITIES], STATIC_DECLS),
    [
      /^scrollbar-none$/,
      function* (_m, ctx) {
        yield { "scrollbar-width": "none" };
        yield {
          [ctx.symbols.selector]: (s: string) => `${s}::-webkit-scrollbar`,
          display: "none",
        };
      },
      { layer: "default", autocomplete: "scrollbar-none" },
    ],
  ];
}
