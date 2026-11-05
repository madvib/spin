/**
 * Headings — `h1` through `h6`, global.
 *
 * A heading level is the element's own statement, so the tag claims the rule
 * and a page that wants the tags left alone turns prose off. The six share
 * the spacing and differ in size, weight, and the level-one lead that opens a
 * document.
 */

import type { Rule } from "@unocss/core";
import { proseTokens, spacing, styleType, type Tokens } from "./shared.ts";

/**
 * A heading: its default style, and the spacing.
 *
 * The gap above a heading is what makes it read as a heading and the gap below
 * is what makes it read as attached to what follows, so the heading states its
 * own block start. The type declarations are the one thing that differs
 * between the six, and each level reads its default style outright — the
 * display voice for the first, the title for the second, and so on down to
 * the overline the last two share. Styles are required: a field the theme
 * does not state is absent, and its declaration is dropped.
 */

function headingRule(
  tag: string,
  style: string,
  type?: (t: Tokens) => Record<string, string | undefined>,
): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const s = styleType(ctx, style);
      const family = s.family;
      const size = s.size;
      const weight = s.weight;
      const tracking = s.tracking;
      const leading = s.leading;
      yield {
        [ctx.symbols.selector]: () => tag,
        ...(family !== undefined ? { "font-family": family } : {}),
        // Single-sided rhythm: the gap above a heading is the previous block's
        // block-end, never the heading's own block-start (DEF A1) — a heading
        // that spent its own start doubled the rhythm unit above every headed
        // section. The h1 same-value end restatement below converges with
        // spacing() and is left as-is.
        ...spacing(t),
        ...(type !== undefined ? type(t) : {}),
        // The style's answer: the level's size, weight, tracking and
        // leading are the style's, and a silent style drops the declaration.
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(weight !== undefined ? { "font-weight": weight } : {}),
        ...(tracking !== undefined ? { "letter-spacing": tracking } : {}),
        ...(leading !== undefined ? { "line-height": leading } : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

function headingRules(): Rule[] {
  return [
    headingRule("h1", "display", (t) => ({
      // A heading level one leads the document, so its bottom gap is a step
      // larger than the shared spacing.
      ...(t.spacing4 !== undefined ? { "margin-block-end": t.spacing4 } : {}),
    })),
    headingRule("h2", "title"),
    headingRule("h3", "heading"),
    headingRule("h4", "label"),
    headingRule("h5", "overline"),
    headingRule("h6", "overline"),
  ];
}

export { headingRule, headingRules };
