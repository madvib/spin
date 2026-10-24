/**
 * Lists — the two orientations, as named utilities.
 *
 * The prose rules give `li + li` a block start so a vertical list breathes.
 * That rule is keyed on the element and cannot tell orientation, so every
 * horizontal list a consumer writes — a nav, a menu, a pagination trail —
 * inherited it too: items two and onward sat a step lower than the first,
 * and the row read as broken. `breadcrumbs` and `join` hand-rolled the
 * reset; every other horizontal list did not have it.
 *
 * `row-list` is the fix with a name: it states the orientation, drops the
 * markers, zeroes the spacing, and does it in one utility rather than three
 * classes the author has to remember in the right combination. `flow-list`
 * is the vertical counterpart for when the element default is not enough.
 */

import type { Rule } from "@unocss/core";
import { proseTokens } from "./primitives/shared.ts";

export function listRules(): Rule[] {
  return [
    // A horizontal list: no markers, no spacing, one line.
    [
      /^row-list$/,
      function* (_m, ctx) {
        const t = proseTokens(ctx);
        yield {
          display: "flex",
          "align-items": "center",
          "list-style-type": "none",
          margin: "0",
          padding: "0",
          // A gap is part of being a row: without it the items touch, and
          // the utility that claims to lay a list out leaves the author to
          // remember a second one.
          ...(t.spacing4 !== undefined ? { "column-gap": t.spacing4 } : {}),
        };
        // The reset is the point, and it has to be scoped: an unscoped
        // `li + li` would take the spacing off every list on the page. The
        // symbol key makes this its own rule with that selector rather than
        // a declaration on `.row-list`.
        yield {
          [ctx.symbols.selector]: () => ".row-list li + li",
          "margin-block-start": "0",
        };
      },
      { layer: "default", autocomplete: "row-list" },
    ],
    // A vertical list: markers off, indentation off, spacing from prose.
    [
      /^flow-list$/,
      () => ({
        "list-style-type": "none",
        margin: "0",
        padding: "0",
      }),
      { layer: "default", autocomplete: "flow-list" },
    ],
  ];
}
