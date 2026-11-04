/**
 * Headings — `h1` through `h6`, global.
 *
 * A heading level is the element's own statement, so the tag claims the rule
 * and a page that wants the tags left alone turns prose off. The six share
 * the spacing and differ in size, weight, and the level-one lead that opens a
 * document.
 */

import { proseTokens, spacing, statedType, type Tokens } from "./shared.ts";
import type { Rule } from "@unocss/core";

/**
 * A heading: the scale step, the heading face, and the spacing.
 *
 * The gap above a heading is what makes it read as a heading and the gap below
 * is what makes it read as attached to what follows, so the heading states its
 * own block start. The type declarations are the one thing that differs
 * between the six, and they arrive as a function of the tokens.
 *
 * The FACE is the theme's display voice, and it is the same for all six: a
 * heading is a heading, and the six differ in scale, not in character. A
 * theme that names no display voice falls back to its body face, so a heading
 * never reads in a face the page does not read in.
 *
 * The theme may say otherwise for ONE level: `font.element.h2.family` moves
 * the second heading and leaves the other five where they are. What the
 * theme does not say, the ladder says — the step the level takes, the weight
 * it takes it at, and the face the six share.
 */
function headingRule(
  tag: string,
  type: (t: Tokens) => Record<string, string | undefined>,
): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const own = statedType(ctx, tag);
      const family = own.family ?? t.heading;
      yield {
        [ctx.symbols.selector]: () => tag,
        ...(family !== undefined ? { "font-family": family } : {}),
        ...spacing(t),
        ...(t.spacing4 !== undefined
          ? { "margin-block-start": t.spacing4 }
          : {}),
        ...type(t),
        // The theme's own decision, where it has one: the level's step and
        // weight are the ladder's until the theme says otherwise.
        ...(own.size !== undefined ? { "font-size": own.size } : {}),
        ...(own.weight !== undefined ? { "font-weight": own.weight } : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

function headingRules(): Rule[] {
  return [
    headingRule("h1", (t) => ({
      ...(t.size3xl !== undefined ? { "font-size": t.size3xl } : {}),
      ...(t.weightBold !== undefined ? { "font-weight": t.weightBold } : {}),
      "line-height": "1.2",
      "letter-spacing": "-0.02em",
      // A heading level one leads the document, so its bottom gap is a step
      // larger than the shared spacing.
      ...(t.spacing4 !== undefined ? { "margin-block-end": t.spacing4 } : {}),
    })),
    headingRule("h2", (t) => ({
      ...(t.size2xl !== undefined ? { "font-size": t.size2xl } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.3",
      "letter-spacing": "-0.01em",
    })),
    headingRule("h3", (t) => ({
      ...(t.sizeXl !== undefined ? { "font-size": t.sizeXl } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.4",
    })),
    headingRule("h4", (t) => ({
      ...(t.sizeLg !== undefined ? { "font-size": t.sizeLg } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.4",
    })),
    headingRule("h5", (t) => ({
      ...(t.sizeMd !== undefined ? { "font-size": t.sizeMd } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.5",
    })),
    headingRule("h6", (t) => ({
      ...(t.sizeSm !== undefined ? { "font-size": t.sizeSm } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.5",
    })),
  ];
}

export { headingRule, headingRules };
