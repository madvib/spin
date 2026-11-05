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

import { paintedTag } from "./scope.ts";
import { ladder, proseTokens, spacing, styleField, styleType } from "./shared.ts";
import type { Rule } from "@unocss/core";

/**
 * A block of a document.
 *
 * The treatment reaches the element through the prose column, and `:where()`
 * is what keeps the reach from adding weight: the block's own specificity is
 * unchanged by where it sits, so scoping the document does not quietly
 * change which of two rules wins.
 */
function block(tag: string): string {
  return paintedTag("prose", "descendant", tag);
}

function bodyRule(): Rule {
  return [
    /^body$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const s = styleType(ctx, "body");
      const family = s.family ?? ladder(ctx, "font.family.body");
      const size = s.size ?? ladder(ctx, "font.size.md");
      yield {
        [ctx.symbols.selector]: () => paintedTag("body", "global", "body"),
        ...(family !== undefined ? { "font-family": family } : {}),
        ...(size !== undefined ? { "font-size": size } : {}),
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
 * Body copy: the spacing below it, and the type it reads in.
 *
 * The paragraph's TYPE is the body's — it inherits the floor — and the
 * paragraph states what it inherits, so a class that says otherwise is a
 * second opinion the lint can see. The paragraph reads the body style
 * outright: the face, the size, the weight, the tracking and the leading a
 * paragraph wears are the body voice's, and a theme moves its paragraphs by
 * moving the style. What the style leaves out, the ladder answers during
 * the window — the body's step for each field.
 */
function paragraphRule(): Rule {
  return [
    /^p$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const s = styleType(ctx, "body");
      const family = s.family ?? ladder(ctx, "font.family.body");
      const size = s.size ?? ladder(ctx, "font.size.md");
      const weight = s.weight ?? ladder(ctx, "font.weight.regular");
      const tracking = s.tracking ?? ladder(ctx, "font.tracking.normal");
      const leading = s.leading ?? ladder(ctx, "font.leading.relaxed");
      yield {
        [ctx.symbols.selector]: () => "p",
        ...(leading !== undefined ? { "line-height": leading } : { "line-height": "1.65" }),
        ...(tracking !== undefined ? { "letter-spacing": tracking } : {}),
        ...(family !== undefined ? { "font-family": family } : {}),
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(weight !== undefined ? { "font-weight": weight } : {}),
        ...spacing(t),
      };
    },
    { layer: "primitives", autocomplete: "p" },
  ];
}

/** A list: the shared spacing, its indent, and the type its rows read in.
 *
 * A list's TYPE is the body's, as the paragraph's is: the rows read the
 * body style outright, and the list states what it inherits so spacing/type
 * overrides have an owner. What the style leaves out, the ladder answers
 * during the window — the body's step for each field.
 */
function listRule(tag: string): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const s = styleType(ctx, "body");
      const family = s.family ?? ladder(ctx, "font.family.body");
      const size = s.size ?? ladder(ctx, "font.size.md");
      const weight = s.weight ?? ladder(ctx, "font.weight.regular");
      const tracking = s.tracking ?? ladder(ctx, "font.tracking.normal");
      const leading = s.leading ?? ladder(ctx, "font.leading.relaxed");
      yield {
        [ctx.symbols.selector]: () => tag,
        ...(leading !== undefined ? { "line-height": leading } : { "line-height": "1.65" }),
        ...(tracking !== undefined ? { "letter-spacing": tracking } : {}),
        ...(family !== undefined ? { "font-family": family } : {}),
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(weight !== undefined ? { "font-weight": weight } : {}),
        ...spacing(t),
        "list-style-type": tag === "ol" ? "decimal" : "disc",
        ...(t.spacing4 !== undefined
          ? { "padding-inline-start": `calc(${t.spacing4} * 1.5)` }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

/**
 * Items breathe a step apart, so a long list stays scannable — and they
 * read in the list's type, now stated on the item too.
 *
 * The second item is the one the rule reaches: the first is the anchor it
 * follows, so the reach is written once. A sibling is not an ancestor, so the
 * rule paints list items wherever they are — the spacing is the theme's, and
 * the type is the body's, stated so overrides on an item have an owner.
 * Nothing here changes rendered output for themes that state nothing: the
 * values stated are the values already inherited, now written down.
 */
function listItemRule(): Rule {
  const li = "li";
  return [
    /^li$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const s = styleType(ctx, "body");
      const family = s.family ?? ladder(ctx, "font.family.body");
      const size = s.size ?? ladder(ctx, "font.size.md");
      const weight = s.weight ?? ladder(ctx, "font.weight.regular");
      yield {
        [ctx.symbols.selector]: () => li,
        ...(family !== undefined ? { "font-family": family } : {}),
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(weight !== undefined ? { "font-weight": weight } : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${li} + ${li}`,
        ...(t.spacing2 !== undefined
          ? { "margin-block-start": t.spacing2 }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "li" },
  ];
}

function definitionListRule(): Rule {
  return [
    /^dl$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => "dl",
        ...spacing(proseTokens(ctx)),
      };
    },
    { layer: "primitives", autocomplete: "dl" },
  ];
}

function termRule(): Rule {
  return [
    /^dt$/,
    function* (_m, ctx) {
      const s = styleType(ctx, "body-strong");
      const weight = s.weight ?? ladder(ctx, "font.weight.semibold");
      yield {
        [ctx.symbols.selector]: () => "dt",
        ...(weight !== undefined ? { "font-weight": weight } : {}),
      };
    },
    { layer: "primitives", autocomplete: "dt" },
  ];
}

function definitionRule(): Rule {
  return [
    /^dd$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => "dd",
        // The definition breathes a step apart from the term (or the
        // definition) above it (DEF A7): without a block-start the entries
        // stacked flush while every sibling block leaves the shared end gap.
        // The rhythm-half of that sibling; the second `dd` in a run reads the
        // same reach, exactly as `li + li` does.
        ...(t.spacing2 !== undefined
          ? { "margin-block-start": t.spacing2 }
          : {}),
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
 * sidebar reads in the same face as a quotation in a document. The quotation
 * reads the quote style outright, and a theme moves its quotations by moving
 * the style. What the style leaves out, the ladder answers during the
 * window — the quote's step for each field.
 *
 * The quotation's TREATMENT — the muted ink it reads in and the inset it is
 * set in — is the document's furniture. It is a long-form column's way of
 * setting a quotation apart, and it belongs inside the column: a quotation
 * outside one is the author's, and reads like the body around it.
 *
 * The footer that carries the attribution is reached through the quotation,
 * so an ordinary `<footer>` elsewhere is not styled as one. The attribution
 * is small print, so it reads the caption style.
 */
function blockquoteRule(): Rule {
  const inset = block("blockquote");
  return [
    /^blockquote$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const s = styleType(ctx, "quote");
      const family = s.family ?? ladder(ctx, "font.family.serif");
      const size = s.size ?? ladder(ctx, "font.size.md");
      const weight = s.weight ?? ladder(ctx, "font.weight.regular");
      const tracking = s.tracking ?? ladder(ctx, "font.tracking.normal");
      const leading = s.leading ?? ladder(ctx, "font.leading.relaxed");
      const footerSize = styleField(ctx, "caption", "size");
      yield {
        [ctx.symbols.selector]: () => "blockquote",
        ...(family !== undefined ? { "font-family": family } : {}),
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(weight !== undefined ? { "font-weight": weight } : {}),
        ...(tracking !== undefined ? { "letter-spacing": tracking } : {}),
        ...(leading !== undefined ? { "line-height": leading } : {}),
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
        [ctx.symbols.selector]: () => `${inset} :is(footer)`,
        ...(t.spacing1 !== undefined
          ? { "margin-block-start": t.spacing1 }
          : {}),
        ...(footerSize !== undefined ? { "font-size": footerSize } : {}),
      };
    },
    { layer: "primitives", autocomplete: "blockquote" },
  ];
}

/** The block family, in emission order. See `proseRules` on why. */
export function blockRules(): Rule[] {
  return [
    paragraphRule(),
    listRule("ul"),
    listRule("ol"),
    listItemRule(),
    definitionListRule(),
    termRule(),
    definitionRule(),
    blockquoteRule(),
  ];
}

export { bodyRule };
