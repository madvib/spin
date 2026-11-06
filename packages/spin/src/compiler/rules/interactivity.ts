import type { SpinRule } from "../utils/lookup.ts";
import { INTERACTIVITY_UTILITIES } from "../utils/vocabulary.ts";
import { STATIC_DECLS } from "../utils/declarations.ts";
import { staticRules } from "../utils/factories.ts";
import { named, type ThemeContext } from "../utils/lookup.ts";

export const INTERACTIVITY_NAMES: readonly string[] = INTERACTIVITY_UTILITIES;

export function interactivityRules(): SpinRule[] {
  return [
    ...staticRules([...INTERACTIVITY_NAMES], STATIC_DECLS),
    [
      /^translate-([xy])-(.+)$/,
      ([, axis, name]: string[], ctx?: ThemeContext) => {
        const value = name === "0" ? "0" : named(ctx, "spacing", name);
        if (value === undefined) return undefined;
        return { transform: `translate${axis.toUpperCase()}(${value})` };
      },
      { autocomplete: "translate-(x|y)-$spacing" },
    ],
  ];
}
