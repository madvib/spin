import type { SpinRule } from "../../utils/lookup.ts";

/**
 * Textarea — a field box that wraps and can be resized by the author.
 *
 * Two declarations are its own. `resize: vertical` because a textarea
 * resizable on both axes can be dragged wider than its container, which
 * overflows the layout rather than the control. And a minimum height, which is
 * derived from the spacing scale because no utility expresses a height
 * computed from two steps — a textarea sized to one line is not a textarea.
 */
export function textareaRules(roots: readonly string[]): SpinRule[] {
  if (!roots.includes("field")) return [];
  return [
    [
      /^textarea$/,
      function* (_m, ctx) {
        const spacing16 = ctx?.theme?.spacing?.[16];
        const spacing4 = ctx?.theme?.spacing?.[4];
        yield {
          [ctx.symbols.selector]: () => "textarea",
          display: "block",
          resize: "vertical",
          ...(spacing16 !== undefined && spacing4 !== undefined
            ? { "min-height": `calc(${spacing16} + ${spacing4})` }
            : {}),
        };
      },
      { layer: "primitives", autocomplete: "textarea" },
    ],
  ];
}
