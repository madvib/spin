import type { Rule } from "@unocss/core";
import { claim, type Mode, proseTokens } from "./shared.ts";
import { painted } from "./scope.ts";
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
function linkRule(mode: Mode): Rule {
  const a = claim(mode, "a");
  return [
    /^a$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const underline = token(ctx, "link.underline");
      yield {
        [ctx.symbols.selector]: () => a,
        ...(t.link !== undefined ? { color: t.link } : {}),
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

function weightRule(mode: Mode, tag: string): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, tag),
        ...(t.weightBold !== undefined ? { "font-weight": t.weightBold } : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

function smallRule(mode: Mode): Rule {
  return [
    /^small$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "small"),
        ...(t.sizeXs !== undefined ? { "font-size": t.sizeXs } : {}),
        ...(t.muted !== undefined ? { color: t.muted } : {}),
      };
    },
    { layer: "primitives", autocomplete: "small" },
  ];
}

function subRule(mode: Mode, tag: string): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, tag),
        ...(t.sizeXs !== undefined ? { "font-size": t.sizeXs } : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

/** An abbreviation: the dotted underline is what says "there is an expansion". */
function abbrRule(mode: Mode): Rule {
  return [
    /^abbr$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => `${claim(mode, "abbr")}[title]`,
        "text-decoration": "underline dotted",
        cursor: "help",
      };
    },
    { layer: "primitives", autocomplete: "abbr" },
  ];
}

function markRule(mode: Mode): Rule {
  return [
    /^mark$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () =>
          painted(mode, "prose", "descendant", "mark"),
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

function insRule(mode: Mode): Rule {
  return [
    /^ins$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () =>
          painted(mode, "prose", "descendant", "ins"),
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

function delRule(mode: Mode): Rule {
  return [
    /^del$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () =>
          painted(mode, "prose", "descendant", "del"),
        "text-decoration": "line-through",
        ...(t.error !== undefined ? { "text-decoration-color": t.error } : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
      };
    },
    { layer: "primitives", autocomplete: "del" },
  ];
}

export function inlineRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("prose")) return [];
  return [
    linkRule(mode),
    weightRule(mode, "strong"),
    weightRule(mode, "b"),
    smallRule(mode),
    subRule(mode, "sub"),
    subRule(mode, "sup"),
    abbrRule(mode),
    markRule(mode),
    insRule(mode),
    delRule(mode),
  ];
}
