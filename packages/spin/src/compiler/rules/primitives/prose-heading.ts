/**
 * Headings — `h1` through `h6`, global.
 *
 * A heading level is the element's own statement, so the tag claims the rule
 * and a page that wants the tags left alone turns prose off. The six share
 * the spacing and differ in size, weight, and the level-one lead that opens a
 * document.
 */

import type { Rule } from "@unocss/core";
import { ladder, proseTokens, spacing, styleType, type Tokens } from "./shared.ts";
import type { GlobalTypePath } from "../../../theme/index.ts";

/**
 * A heading: its default style, and the spacing.
 *
 * The gap above a heading is what makes it read as a heading and the gap below
 * is what makes it read as attached to what follows, so the heading states its
 * own block start. The type declarations are the one thing that differs
 * between the six, and each level reads its default style outright — the
 * display voice for the first, the title for the second, and so on down to
 * the overline the last two share. What a style leaves out, the ladder
 * answers during the window: the step the level takes, the weight it takes
 * it at, and the face the six share.
 */
/** A ladder read bound to the rule's context, for a level's window fallback. */
export type Ladder = (path: GlobalTypePath) => string | undefined;

function headingRule(
  tag: string,
  style: string,
  type: (t: Tokens, ladderFor: Ladder) => Record<string, string | undefined>,
): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const s = styleType(ctx, style);
      const family = s.family ?? ladder(ctx, "font.family.heading");
      const size = s.size;
      const weight = s.weight;
      const tracking = s.tracking;
      const leading = s.leading;
      const ladderFor: Ladder = (path) => ladder(ctx, path);
      yield {
        [ctx.symbols.selector]: () => tag,
        ...(family !== undefined ? { "font-family": family } : {}),
        // Single-sided rhythm: the gap above a heading is the previous block's
        // block-end, never the heading's own block-start (DEF A1) — a heading
        // that spent its own start doubled the rhythm unit above every headed
        // section. The h1 same-value end restatement below converges with
        // spacing() and is left as-is.
        ...spacing(t),
        ...type(t, ladderFor),
        // The style's answer, where it has one: the level's size, weight,
        // tracking and leading are the style's, and a silent style leaves
        // the declaration to the ladder the level's own rule states below.
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
    headingRule("h1", "display", (t, ladderFor) => ({
      ...(ladderFor("font.size.3xl") !== undefined
        ? { "font-size": ladderFor("font.size.3xl") }
        : {}),
      ...(ladderFor("font.weight.bold") !== undefined
        ? { "font-weight": ladderFor("font.weight.bold") }
        : {}),
      ...(ladderFor("font.leading.tight") !== undefined
        ? { "line-height": ladderFor("font.leading.tight") }
        : { "line-height": "1.2" }),
      ...(ladderFor("font.tracking.tight") !== undefined
        ? { "letter-spacing": ladderFor("font.tracking.tight") }
        : { "letter-spacing": "-0.02em" }),
      // A heading level one leads the document, so its bottom gap is a step
      // larger than the shared spacing.
      ...(t.spacing4 !== undefined ? { "margin-block-end": t.spacing4 } : {}),
    })),
    headingRule("h2", "title", (t, ladderFor) => ({
      ...(ladderFor("font.size.2xl") !== undefined
        ? { "font-size": ladderFor("font.size.2xl") }
        : {}),
      ...(ladderFor("font.weight.semibold") !== undefined
        ? { "font-weight": ladderFor("font.weight.semibold") }
        : {}),
      ...(ladderFor("font.leading.snug") !== undefined
        ? { "line-height": ladderFor("font.leading.snug") }
        : { "line-height": "1.3" }),
      ...(ladderFor("font.tracking.normal") !== undefined
        ? { "letter-spacing": ladderFor("font.tracking.normal") }
        : { "letter-spacing": "-0.01em" }),
    })),
    headingRule("h3", "heading", (t, ladderFor) => ({
      ...(ladderFor("font.size.xl") !== undefined
        ? { "font-size": ladderFor("font.size.xl") }
        : {}),
      ...(ladderFor("font.weight.semibold") !== undefined
        ? { "font-weight": ladderFor("font.weight.semibold") }
        : {}),
      "line-height": "1.4",
    })),
    headingRule("h4", "label", (t, ladderFor) => ({
      ...(ladderFor("font.size.lg") !== undefined
        ? { "font-size": ladderFor("font.size.lg") }
        : {}),
      ...(ladderFor("font.weight.semibold") !== undefined
        ? { "font-weight": ladderFor("font.weight.semibold") }
        : {}),
      "line-height": "1.4",
    })),
    headingRule("h5", "overline", (t, ladderFor) => ({
      ...(ladderFor("font.size.md") !== undefined
        ? { "font-size": ladderFor("font.size.md") }
        : {}),
      ...(ladderFor("font.weight.semibold") !== undefined
        ? { "font-weight": ladderFor("font.weight.semibold") }
        : {}),
      "line-height": "1.5",
    })),
    headingRule("h6", "overline", (t, ladderFor) => ({
      ...(ladderFor("font.size.sm") !== undefined
        ? { "font-size": ladderFor("font.size.sm") }
        : {}),
      ...(ladderFor("font.weight.semibold") !== undefined
        ? { "font-weight": ladderFor("font.weight.semibold") }
        : {}),
      "line-height": "1.5",
    })),
  ];
}

export { headingRule, headingRules };
