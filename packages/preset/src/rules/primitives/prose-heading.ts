/**
 * Headings — `h1` through `h6`, global.
 *
 * A heading level is the element's own statement, so the tag claims the rule
 * and a page that wants the tags left alone turns prose off. The six share a
 * rhythm and differ in size, weight, and the level-one lead that opens a
 * document.
 */

import {
  claim,
  type Mode,
  proseTokens,
  rhythm,
  type Tokens,
} from "./shared.ts";
import type { Rule } from "@unocss/core";

/**
 * A heading: the scale step, the heading face, and the rhythm.
 *
 * The gap above a heading is what makes it read as a heading and the gap below
 * is what makes it read as attached to what follows, so the heading states its
 * own block start. The type declarations are the one thing that differs
 * between the six, and they arrive as a function of the tokens.
 */
function headingRule(
  mode: Mode,
  tag: string,
  type: (t: Tokens) => Record<string, string | undefined>,
): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      // The element's own claim, then the shared heading face. A theme that
      // maps `<h1>` to a face of its own moves `<h1>` and nothing else.
      const face = t.element?.[tag];
      const family = face !== undefined ? slot(face, t) : t.heading;
      yield {
        [ctx.symbols.selector]: () => claim(mode, tag),
        ...(family !== undefined ? { "font-family": family } : {}),
        ...rhythm(t),
        ...(t.spacing4 !== undefined
          ? { "margin-block-start": t.spacing4 }
          : {}),
        ...type(t),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

function headingRules(mode: Mode): Rule[] {
  return [
    headingRule(mode, "h1", (t) => ({
      ...(t.size3xl !== undefined ? { "font-size": t.size3xl } : {}),
      ...(t.weightBold !== undefined ? { "font-weight": t.weightBold } : {}),
      "line-height": "1.2",
      "letter-spacing": "-0.02em",
      // A heading level one leads the document, so its bottom gap is a step
      // larger than the shared rhythm.
      ...(t.spacing4 !== undefined ? { "margin-block-end": t.spacing4 } : {}),
    })),
    headingRule(mode, "h2", (t) => ({
      ...(t.size2xl !== undefined ? { "font-size": t.size2xl } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.3",
      "letter-spacing": "-0.01em",
    })),
    headingRule(mode, "h3", (t) => ({
      ...(t.sizeXl !== undefined ? { "font-size": t.sizeXl } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.4",
    })),
    headingRule(mode, "h4", (t) => ({
      ...(t.sizeLg !== undefined ? { "font-size": t.sizeLg } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.4",
    })),
    headingRule(mode, "h5", (t) => ({
      ...(t.sizeMd !== undefined ? { "font-size": t.sizeMd } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.5",
    })),
    headingRule(mode, "h6", (t) => ({
      ...(t.sizeSm !== undefined ? { "font-size": t.sizeSm } : {}),
      ...(t.weightSemibold !== undefined
        ? { "font-weight": t.weightSemibold }
        : {}),
      "line-height": "1.5",
    })),
  ];
}

export { headingRule, headingRules };

/** A family slot resolved from a named face, for a per-element override. */
function slot(face: string, t: Tokens): string | undefined {
  const families: Record<string, string | undefined> = {
    heading: t.heading,
    body: t.body,
    sans: t.sans,
    serif: t.serif,
    mono: t.mono,
  };
  return families[face];
}
