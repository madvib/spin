/**
 * Prose blocks — the pico surface for a document's body content.
 *
 * `body`, `p`, `ul`, `ol`, `li`, `dl`, `dt`, `dd`, `blockquote`: the elements
 * a page writes without being asked, each claiming its tag globally so the
 * element is the contract. The rhythm is stated per element rather than as a
 * shared block, because a shared rule would have to be keyed on one tag and
 * would drag every other tag's rule in with it.
 *
 * Body and container are separate rules that set disjoint properties, so
 * neither wins by source order.
 */

import { claim, type Mode, proseTokens, rhythm } from "./shared.ts";
import type { Rule } from "@unocss/core";

function bodyRule(mode: Mode): Rule {
  return [
    /^body$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "body"),
        ...(t.sans !== undefined ? { "font-family": t.sans } : {}),
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

/** Body copy: the type, the measure, and the rhythm below it. */
function paragraphRule(mode: Mode): Rule {
  return [
    /^p$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => claim(mode, "p"),
        ...rhythm(proseTokens(ctx)),
      };
    },
    { layer: "primitives", autocomplete: "p" },
  ];
}

/** A list: the shared rhythm, and an indent the markers hang off. */
function listRule(mode: Mode, tag: string): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, tag),
        ...rhythm(t),
        ...(t.spacing4 !== undefined
          ? { "padding-inline-start": t.spacing4 }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

/** Items breathe a step apart, so a long list stays scannable. */
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
        ...rhythm(proseTokens(ctx)),
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
 * A quotation: an inset block with a rule in the margin.
 *
 * The footer that carries the attribution is reached through the blockquote,
 * so an ordinary `<footer>` elsewhere is not styled as one.
 */
function blockquoteRule(mode: Mode): Rule {
  const blockquote = claim(mode, "blockquote");
  return [
    /^blockquote$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => blockquote,
        ...rhythm(t),
        ...(t.spacing2 !== undefined && t.spacing4 !== undefined
          ? { padding: `${t.spacing2} ${t.spacing4}` }
          : {}),
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { "border-inline-start": `${t.borderWidth} solid ${t.border}` }
          : {}),
        ...(t.muted !== undefined ? { color: t.muted } : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${blockquote} ${claim(mode, "footer")}`,
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
