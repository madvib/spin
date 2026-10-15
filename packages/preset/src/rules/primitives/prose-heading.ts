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
      // The element's own claim, then the shared tokens. A theme that maps
      // `<h1>` to a face, or a size, of its own moves `<h1>` and nothing
      // else — which is the whole point of an override.
      const own = ownType(t, tag);
      yield {
        [ctx.symbols.selector]: () => claim(mode, tag),
        ...(own.face !== undefined ? { "font-family": own.face } : {}),
        ...(own.size !== undefined ? { "font-size": own.size } : {}),
        ...(own.weight !== undefined ? { "font-weight": own.weight } : {}),
        ...(own.lineHeight !== undefined
          ? { "line-height": own.lineHeight }
          : {}),
        ...(own.tracking !== undefined
          ? { "letter-spacing": own.tracking }
          : {}),
        ...rhythm(t),
        ...(t.spacing4 !== undefined
          ? { "margin-block-start": t.spacing4 }
          : {}),
        ...(own.size === undefined && own.weight === undefined ? type(t) : {}),
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

/** The type an element claims for itself, with its face resolved. */
function ownType(
  t: Tokens,
  tag: string,
): {
  face?: string;
  size?: string;
  weight?: string;
  lineHeight?: string;
  tracking?: string;
} {
  const entry = t.element?.[tag];
  if (entry === undefined) return {};
  const declared = typeof entry === "string" ? { face: entry } : entry;
  const families: Record<string, string | undefined> = {
    heading: t.heading,
    body: t.body,
    sans: t.sans,
    serif: t.serif,
    mono: t.mono,
  };
  return {
    ...(declared.face !== undefined
      ? { face: families[declared.face] ?? declared.face }
      : {}),
    ...(declared.size !== undefined ? { size: declared.size } : {}),
    ...(declared.weight !== undefined ? { weight: declared.weight } : {}),
    ...(declared.lineHeight !== undefined
      ? { lineHeight: declared.lineHeight }
      : {}),
    ...(declared.tracking !== undefined ? { tracking: declared.tracking } : {}),
  };
}
