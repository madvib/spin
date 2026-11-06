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
import { proseTokens, spacing } from "./shared.ts";
import type { ThemeType } from "../../../theme/theme-types.d.ts";
import type { SpinRule } from "../../utils/lookup.ts";

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

function bodyRule(): SpinRule {
  return [
    /^body$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const s: ThemeType | undefined = ctx?.theme?.font?.style?.body;
      const family = s?.["font-family"];
      const size = s?.["font-size"];
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
 */
function paragraphRule(): SpinRule {
  return [
    /^p$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const primary = ctx?.theme?.element?.p?.type;
      const shared = ctx?.theme?.font?.style?.body;
      const s: ThemeType | undefined = primary ?? shared;
      yield {
        [ctx.symbols.selector]: () => "p",
        ...(s?.["line-height"] !== undefined
          ? { "line-height": s["line-height"] }
          : { "line-height": "1.65" }),
        ...(s?.["letter-spacing"] !== undefined ? { "letter-spacing": s["letter-spacing"] } : {}),
        ...(s?.["font-family"] !== undefined ? { "font-family": s["font-family"] } : {}),
        ...(s?.["font-size"] !== undefined ? { "font-size": s["font-size"] } : {}),
        ...(s?.["font-weight"] !== undefined ? { "font-weight": s["font-weight"] } : {}),
        ...spacing(t),
      };
    },
    { layer: "primitives", autocomplete: "p" },
  ];
}

/** A list: the shared spacing, its indent, and the type its rows read in. */
function listRule(tag: string): SpinRule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const s: ThemeType | undefined = ctx?.theme?.font?.style?.body;
      yield {
        [ctx.symbols.selector]: () => tag,
        ...(s?.["line-height"] !== undefined
          ? { "line-height": s["line-height"] }
          : { "line-height": "1.65" }),
        ...(s?.["letter-spacing"] !== undefined ? { "letter-spacing": s["letter-spacing"] } : {}),
        ...(s?.["font-family"] !== undefined ? { "font-family": s["font-family"] } : {}),
        ...(s?.["font-size"] !== undefined ? { "font-size": s["font-size"] } : {}),
        ...(s?.["font-weight"] !== undefined ? { "font-weight": s["font-weight"] } : {}),
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
function listItemRule(): SpinRule {
  const li = "li";
  return [
    /^li$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const s: ThemeType | undefined = ctx?.theme?.font?.style?.body;
      const family = s?.["font-family"];
      const size = s?.["font-size"];
      const weight = s?.["font-weight"];
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

function definitionListRule(): SpinRule {
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

function termRule(): SpinRule {
  return [
    /^dt$/,
    function* (_m, ctx) {
      const primary = ctx?.theme?.element?.dt?.type;
      const shared = ctx?.theme?.font?.style?.["body-strong"];
      const s: ThemeType | undefined = primary ?? shared;
      const weight = s?.["font-weight"];
      yield {
        [ctx.symbols.selector]: () => "dt",
        ...(weight !== undefined ? { "font-weight": weight } : {}),
      };
    },
    { layer: "primitives", autocomplete: "dt" },
  ];
}

function definitionRule(): SpinRule {
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
 */
function blockquoteRule(): SpinRule {
  const inset = block("blockquote");
  return [
    /^blockquote$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const primary = ctx?.theme?.element?.blockquote?.type;
      const shared = ctx?.theme?.font?.style?.quote;
      const s: ThemeType | undefined = primary ?? shared;
      const footerSize = ctx?.theme?.font?.style?.caption?.["font-size"];
      yield {
        [ctx.symbols.selector]: () => "blockquote",
        ...(s ?? {}),
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
export function blockRules(): SpinRule[] {
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
