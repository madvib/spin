import type { Rule } from "@unocss/core";

/**
 * Select — a field box with a pointer and its own disclosure arrow.
 *
 * It differs from a text field in exactly two ways: it is clickable, and the
 * platform draws a native dropdown. Everything else is the shared box in
 * `field.ts`, which is why this rule is this short — restating the border and
 * the ring here would be a second place for them to drift.
 */
export function selectRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("select")) return [];
  return [
    [
      /^select$/,
      function* (_m, ctx) {
        yield {
          [ctx.symbols.selector]: () => "select",
          cursor: "pointer",
        };
      },
      { layer: "primitives", autocomplete: "select" },
    ],
  ];
}