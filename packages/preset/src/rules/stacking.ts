import type { Rule } from "@unocss/core";
import { named, type ThemeContext } from "../utils/lookup.ts";

/**
 * The stacking families: `z-*` and the `isolate`/`static` pair.
 *
 * A SMALL set, and deliberately so. The theme declares four stacking steps
 * with MEANINGS — base, dropdown, modal, toast — rather than a numeric ramp,
 * because what a number means depends on what else is on the page: a `z-50`
 * is modal in an app that goes to 100 and invisible in one that does not. The
 * names are the decision, and `z-modal` is legible to a reader in a way `z-50`
 * is not.
 *
 * `isolate` earns its place beside them for the opposite reason: it is the one
 * stacking utility with no value at all, and it is what makes a `z-*` on a
 * child mean what the author thinks it means. A `position: relative` without
 * it participates in whatever ancestor is positioned; with it, the child is
 * scoped to the parent. That is a decision, not a number, so it is its own
 * name.
 */

/** The theme's steps, in the order they stack. */
const STACKING = ["base", "dropdown", "modal", "toast"] as const;

export function stackingRules(): Rule[] {
  const steps: Rule[] = STACKING.map((step): Rule => [
    new RegExp(`^z-${step}$`),
    (_match: RegExpMatchArray, ctx?: ThemeContext) => {
      const value = named(ctx, "z-index", step);
      return value === undefined ? undefined : { "z-index": value };
    },
    { autocomplete: "z-$zIndex" },
  ]);

  // The numeric fallback, for an author who genuinely needs a value between
  // ours. It is a number rather than a token, and it is here precisely so that
  // using one is a visible choice.
  const numeric: Rule = [
    /^z-(\d+)$/,
    ([, n]: string[]) => ({ "z-index": n }),
    { autocomplete: "z-<number>" },
  ];

  // `isolate` scopes a subtree's stacking to itself. Without it a child's `z-*`
  // is measured against the nearest positioned ANCESTOR, which is almost never
  // what the author meant — and the failure is silent, because the number was
  // applied and simply did not do what it looked like it did.
  const isolation: Rule[] = [
    ["isolate", { isolation: "isolate" }],
    ["static", { isolation: "static" }],
  ];

  return [...steps, numeric, ...isolation];
}

/**
 * Every name these rules match.
 *
 * Declared here rather than discovered by running the generator, because the
 * catalog reads a list and a rule that does not publish one is invisible to
 * the reference while still shipping CSS — the exact failure that left eight
 * utilities in the system and out of the docs.
 */
export const STACKING_NAMES: readonly string[] = [
  ...STACKING.map((step) => `z-${step}`),
  "isolate",
  "static",
];

export { STACKING };
