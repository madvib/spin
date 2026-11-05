import type { Rule } from "@unocss/core";
import { proseTokens, statedType } from "./shared.ts";
import { paintedTag } from "./scope.ts";
import { token } from "../../utils/lookup.ts";

/**
 * Inline text: links, weight, `small`, sub/superscript, `abbr`, `mark`, `ins`,
 * `del`.
 *
 * All inline, all decorating a run of text rather than a block, none with a
 * state. This is prose's typographic layer as distinct from its structural one:
 * how a link reads is not how a list indents, and the two were one file.
 */

/**
 * A link: the one piece of prose that is also a control.
 *
 * The underline is the accessible default — colour alone is not enough to find
 * a link — and it thickens on hover. The focus ring belongs to the link
 * because the link is what receives focus.
 *
 * The underline's own weight is the link's decision (`link.underline`): a
 * theme that underlines lightly and a theme that underlines like a rule are
 * both saying something, and neither is the browser's. A theme that writes
 * nothing gets the browser's own underline; a theme that writes zero marks
 * the link by colour alone, and the hover brings the underline back.
 */
function linkRule(): Rule {
  const a = "a";
  return [
    /^a$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const underline = token(ctx, "link.underline");
      const own = statedType(ctx, "a");
      yield {
        [ctx.symbols.selector]: () => a,
        ...(t.link !== undefined ? { color: t.link } : {}),
        // A link is a run of text in the body, and the theme may say
        // otherwise: the face, the size and the weight of a link are the
        // theme's to set, and a link that reads at the body's weight is a
        // theme's answer rather than the browser's.
        ...(own.family !== undefined ? { "font-family": own.family } : {}),
        ...(own.size !== undefined ? { "font-size": own.size } : {}),
        ...(own.weight !== undefined ? { "font-weight": own.weight } : {}),
        ...(own.tracking !== undefined ? { "letter-spacing": own.tracking } : {}),
        ...(own.leading !== undefined ? { "line-height": own.leading } : {}),
        "text-decoration": "underline",
        "text-underline-offset": "0.2em",
        // The theme's own weight for the rule, or the browser's own
        // underline when the theme says nothing.
        ...(underline !== undefined
          ? { "text-decoration-thickness": underline }
          : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${a}:hover`,
        // The hover thickens the underline rather than replacing it, and it
        // never thins it: a link marked by colour alone shows its rule the
        // moment the reader reaches for it.
        "text-decoration-thickness": underline !== undefined
          ? `max(0.1em, calc(${underline} * 2))`
          : "0.1em",
      };
      yield {
        [ctx.symbols.selector]: () => `${a}:focus-visible`,
        ...(t.focusWidth !== undefined && t.focusRing !== undefined
          ? { outline: `${t.focusWidth} solid ${t.focusRing}` }
          : {}),
        ...(t.focusOffset !== undefined
          ? { "outline-offset": t.focusOffset }
          : {}),
        ...(t.radiusSm !== undefined ? { "border-radius": t.radiusSm } : {}),
      };
    },
    { layer: "primitives", autocomplete: "a" },
  ];
}

function weightRule(tag: string): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const own = statedType(ctx, tag);
      const weight = own.weight ?? t.weightBold;
      yield {
        [ctx.symbols.selector]: () => tag,
        ...(own.family !== undefined ? { "font-family": own.family } : {}),
        ...(own.size !== undefined ? { "font-size": own.size } : {}),
        ...(weight !== undefined ? { "font-weight": weight } : {}),
        ...(own.tracking !== undefined ? { "letter-spacing": own.tracking } : {}),
        ...(own.leading !== undefined ? { "line-height": own.leading } : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

function smallRule(): Rule {
  return [
    /^small$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const own = statedType(ctx, "small");
      const size = own.size ?? t.sizeXs;
      yield {
        [ctx.symbols.selector]: () => "small",
        ...(own.family !== undefined ? { "font-family": own.family } : {}),
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(own.weight !== undefined ? { "font-weight": own.weight } : {}),
        ...(own.tracking !== undefined ? { "letter-spacing": own.tracking } : {}),
        ...(own.leading !== undefined ? { "line-height": own.leading } : {}),
        ...(t.muted !== undefined ? { color: t.muted } : {}),
      };
    },
    { layer: "primitives", autocomplete: "small" },
  ];
}

function subRule(tag: string): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => tag,
        ...(t.sizeXs !== undefined ? { "font-size": t.sizeXs } : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

/** An abbreviation: the dotted underline is what says "there is an expansion". */
function abbrRule(): Rule {
  return [
    /^abbr$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => "abbr[title]",
        "text-decoration": "underline dotted",
        cursor: "help",
      };
    },
    { layer: "primitives", autocomplete: "abbr" },
  ];
}

function markRule(): Rule {
  return [
    /^mark$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () =>
          paintedTag("prose", "descendant", "mark"),
        ...(t.spacing1 !== undefined
          ? { padding: `0 calc(${t.spacing1} / 2)` }
          : {}),
        ...(t.accent !== undefined ? { "background-color": t.accent } : {}),
        // The theme states what reads ON its accent; the page surface is
        // what the accent sits on, and a starter whose accent is lighter
        // than its surface (neobrut's amber) makes that pairing illegible.
        ...(t.onAccent !== undefined ? { color: t.onAccent } : {}),
      };
    },
    { layer: "primitives", autocomplete: "mark" },
  ];
}

function insRule(): Rule {
  return [
    /^ins$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () =>
          paintedTag("prose", "descendant", "ins"),
        "text-decoration": "underline",
        // The hue marks the insertion in the underline; the TEXT keeps the
        // ink. A semantic colour as text is a fill's pairing worn on a
        // glyph, and a starter whose success is lighter than its ink
        // (neobrut) fails contrast with it.
        ...(t.success !== undefined
          ? { "text-decoration-color": t.success }
          : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
      };
    },
    { layer: "primitives", autocomplete: "ins" },
  ];
}

function delRule(): Rule {
  return [
    /^del$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () =>
          paintedTag("prose", "descendant", "del"),
        "text-decoration": "line-through",
        ...(t.error !== undefined ? { "text-decoration-color": t.error } : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
      };
    },
    { layer: "primitives", autocomplete: "del" },
  ];
}

export function inlineRules(): Rule[] {
  return [
    linkRule(),
    weightRule("strong"),
    weightRule("b"),
    smallRule(),
    subRule("sub"),
    subRule("sup"),
    abbrRule(),
    markRule(),
    insRule(),
    delRule(),
  ];
}
