/**
 * Prose blocks — the elements a page writes without being asked.
 *
 * `body`, `p`, `ul`, `ol`, `li`, `dl`, `dt`, `dd`: the spacing of a page, and
 * the type it reads in. Their treatment is TYPOGRAPHY, and typography is
 * spin's own for the whole application — so these rules claim their tags
 * globally. A paragraph outside a document column reads the same as a
 * paragraph inside one, because the theme's spacing is not the document's to
 * give.
 *
 * The spacing is stated per element rather than as a shared block, because a
 * shared rule would have to be keyed on one tag and would drag every other
 * tag's rule in with it.
 *
 * Body and container are separate rules that set disjoint properties, so
 * neither wins by source order.
 */

import {
  claim,
  type Mode,
  proseTokens,
  spacing,
  statedType,
} from "./shared.ts";
import { painted } from "./scope.ts";
import type { Rule } from "@unocss/core";

/**
 * A block of a document.
 *
 * The treatment reaches the element through the prose column, and `:where()`
 * is what keeps the reach from adding weight: the block's own specificity is
 * unchanged by where it sits, so scoping the document does not quietly
 * change which of two rules wins.
 */
function block(mode: Mode, tag: string): string {
  return painted(mode, "prose", "descendant", tag);
}

function bodyRule(mode: Mode): Rule {
  return [
    /^body$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => painted(mode, "body", "global", "body"),
        ...(t.body !== undefined ? { "font-family": t.body } : {}),
        ...(t.sizeMd !== undefined ? { "font-size": t.sizeMd } : {}),
        "line-height": "1.5",
        ...(t.text !== undefined ? { color: t.text } : {}),
        ...(t.surface !== undefined ? { "background-color": t.surface } : {}),
        margin: "0",
      };
    },
    { layer: "primitives", autocomplete: "body" },
  ];
}

/**
 * Body copy: the spacing below it.
 *
 * The paragraph's TYPE is the body's — it inherits the floor — and the
 * paragraph's own decision is the gap it leaves under itself. Both are the
 * theme's, and both are spent wherever a paragraph is written.
 *
 * The theme may set the paragraph's type for itself: `font.element.p.family`,
 * `font.element.p.size` and `font.element.p.weight` are the paragraph's own
 * answer, and where the theme gives one it replaces what the paragraph would
 * otherwise read. What it leaves out, the paragraph reads as it always has.
 */
function paragraphRule(mode: Mode): Rule {
  return [
    /^p$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const own = statedType(ctx, "p");
      yield {
        [ctx.symbols.selector]: () => claim(mode, "p"),
        ...(own.family !== undefined ? { "font-family": own.family } : {}),
        ...(own.size !== undefined ? { "font-size": own.size } : {}),
        ...(own.weight !== undefined ? { "font-weight": own.weight } : {}),
        ...spacing(t),
      };
    },
    { layer: "primitives", autocomplete: "p" },
  ];
}

/** A list: the shared spacing, and an indent the markers hang off. */
function listRule(mode: Mode, tag: string): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, tag),
        ...spacing(t),
        ...(t.spacing4 !== undefined
          ? { "padding-inline-start": t.spacing4 }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

/**
 * Items breathe a step apart, so a long list stays scannable.
 *
 * The second item is the one the rule reaches: the first is the anchor it
 * follows, so the reach is written once. A sibling is not an ancestor, so the
 * rule paints list items wherever they are — the spacing is the theme's.
 */
function listItemRule(mode: Mode): Rule {
  const li = claim(mode, "li");
  return [
    /^li$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => `${li} + ${li}`,
        ...(t.spacing1 !== undefined
          ? { "margin-block-start": t.spacing1 }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "li" },
  ];
}

function definitionListRule(mode: Mode): Rule {
  return [
    /^dl$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => claim(mode, "dl"),
        ...spacing(proseTokens(ctx)),
      };
    },
    { layer: "primitives", autocomplete: "dl" },
  ];
}

function termRule(mode: Mode): Rule {
  return [
    /^dt$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "dt"),
        ...(t.weightSemibold !== undefined
          ? { "font-weight": t.weightSemibold }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "dt" },
  ];
}

function definitionRule(mode: Mode): Rule {
  return [
    /^dd$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "dd"),
        ...(t.spacing4 !== undefined
          ? { "margin-inline-start": t.spacing4 }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "dd" },
  ];
}

/**
 * A quotation.
 *
 * Two treatments, and they belong to different owners.
 *
 * The quotation's VOICE — the face it reads in and the spacing it sits in — is
 * typography, and typography is the theme's everywhere: a quotation in a
 * sidebar reads in the same face as a quotation in a document. The face is
 * the theme's editorial voice, and a theme that names none leaves the
 * quotation in the body's face.
 *
 * The quotation's TREATMENT — the muted ink it reads in and the inset it is
 * set in — is the document's furniture. It is a long-form column's way of
 * setting a quotation apart, and it belongs inside the column: a quotation
 * outside one is the author's, and reads like the body around it.
 *
 * The footer that carries the attribution is reached through the quotation,
 * so an ordinary `<footer>` elsewhere is not styled as one.
 */
function blockquoteRule(mode: Mode): Rule {
  const inset = block(mode, "blockquote");
  return [
    /^blockquote$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const own = statedType(ctx, "blockquote");
      const family = own.family ?? t.serif;
      yield {
        [ctx.symbols.selector]: () => claim(mode, "blockquote"),
        ...(family !== undefined ? { "font-family": family } : {}),
        ...(own.size !== undefined ? { "font-size": own.size } : {}),
        ...(own.weight !== undefined ? { "font-weight": own.weight } : {}),
        ...spacing(t),
      };
      yield {
        [ctx.symbols.selector]: () => inset,
        ...(t.spacing2 !== undefined && t.spacing4 !== undefined
          ? { padding: `${t.spacing2} ${t.spacing4}` }
          : {}),
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { "border-inline-start": `${t.borderWidth} solid ${t.border}` }
          : {}),
        ...(t.muted !== undefined ? { color: t.muted } : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${inset} :is(${claim(mode, "footer")})`,
        ...(t.spacing1 !== undefined
          ? { "margin-block-start": t.spacing1 }
          : {}),
        ...(t.sizeSm !== undefined ? { "font-size": t.sizeSm } : {}),
      };
    },
    { layer: "primitives", autocomplete: "blockquote" },
  ];
}

/** The block family, in emission order. See `proseRules` on why. */
export function blockRules(mode: Mode): Rule[] {
  return [
    paragraphRule(mode),
    listRule(mode, "ul"),
    listRule(mode, "ol"),
    listItemRule(mode),
    definitionListRule(mode),
    termRule(mode),
    definitionRule(mode),
    blockquoteRule(mode),
  ];
}

export { bodyRule };
