/**
 * Headings — `h1` through `h6`, global.
 *
 * A heading level is the element's own statement, so the tag claims the rule
 * and a page that wants the tags left alone turns prose off. The six share
 * the spacing and differ in size, weight, and the level-one lead that opens a
 * document.
 */

import type { SpinRule } from "../../utils/lookup.ts";
import type { Theme, ThemeType } from "../../../theme/theme-types.d.ts";
import { proseTokens, spacing, type Tokens } from "./shared.ts";

/**
 * A heading: its default style, and the spacing.
 *
 * The gap above a heading is what makes it read as a heading and the gap below
 * is what makes it read as attached to what follows, so the heading states its
 * own block start. The type declarations are the one thing that differs
 * between the six, and each level reads its element type outright — the
 * display style for the first, the title for the second, and so on down to
 * the overline for the last. Styles are required: a field the theme
 * does not state is absent, and its declaration is dropped.
 */

function headingRule(
  tag: string,
  style: keyof NonNullable<NonNullable<Theme["font"]>["style"]>,
  element: keyof NonNullable<Theme["element"]>,
  type?: (t: Tokens) => Record<string, string | undefined>,
): SpinRule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      // Both reads are recorded: the element's own type, then the style it
      // defaults to when the theme states no element type.
      const primary = ctx?.theme?.element?.[element]?.type;
      const shared = ctx?.theme?.font?.style?.[style];
      const s: ThemeType | undefined = primary ?? shared;
      yield {
        [ctx.symbols.selector]: () => tag,
        // Single-sided rhythm: the gap above a heading is the previous block's
        // block-end, never the heading's own block-start (DEF A1) — a heading
        // that spent its own start doubled the rhythm unit above every headed
        // section. The h1 same-value end restatement below converges with
        // spacing() and is left as-is.
        ...spacing(t),
        ...(type !== undefined ? type(t) : {}),
        // The element type's answer, spread outright.
        ...(s ?? {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

function headingRules(): SpinRule[] {
  return [
    headingRule("h1", "display", "h1", (t) => ({
      // A heading level one leads the document, so its bottom gap is a step
      // larger than the shared spacing.
      ...(t.spacing4 !== undefined ? { "margin-block-end": t.spacing4 } : {}),
    })),
    headingRule("h2", "title", "h2"),
    headingRule("h3", "heading", "h3"),
    headingRule("h4", "label", "h4"),
    headingRule("h5", "overline", "h5"),
    headingRule("h6", "overline", "h6"),
  ];
}

export { headingRule, headingRules };
