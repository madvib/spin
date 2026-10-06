import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import {
  claim,
  proseTokens,
  rhythm,
  type Mode,
  type Tokens,
} from "./shared.ts";

/**
 * Embedded media: `figure`, `figcaption`, the raster and vector elements, and
 * the frame elements.
 *
 * The only part of prose that brings its own box. Everything else is a run of
 * text inside the reader's column; a figure has edges, a caption has its own
 * rhythm, and an embed has a size the document does not otherwise impose.
 */

function figureRule(mode: Mode): Rule {
  return [
    /^figure$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => claim(mode, "figure"),
        ...rhythm(proseTokens(ctx)),
        "margin-inline": "0",
      };
    },
    { layer: "primitives", autocomplete: "figure" },
  ];
}

function figcaptionRule(mode: Mode): Rule {
  return [
    /^figcaption$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "figcaption"),
        ...(t.spacing1 !== undefined ? { "margin-block-start": t.spacing1 } : {}),
        ...(t.sizeSm !== undefined ? { "font-size": t.sizeSm } : {}),
        ...(t.muted !== undefined ? { color: t.muted } : {}),
        "text-align": "center",
      };
    },
    { layer: "primitives", autocomplete: "figcaption" },
  ];
}

/** Media never overflows its column, and raster/video carry the card's corner. */
function mediaRule(mode: Mode, tag: string): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, tag),
        display: "block",
        "max-width": "100%",
        height: "auto",
        ...((tag === "img" || tag === "video") && t.radiusMd !== undefined
          ? { "border-radius": t.radiusMd }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

function embeddedRule(mode: Mode, tag: string): Rule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, tag),
        display: "block",
        "max-width": "100%",
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { border: `${t.borderWidth} solid ${t.border}` }
          : {}),
        ...(t.radiusMd !== undefined ? { "border-radius": t.radiusMd } : {}),
      };
    },
    { layer: "primitives", autocomplete: tag },
  ];
}

export function mediaRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("prose")) return [];
  return [
    figureRule(mode),
    figcaptionRule(mode),
    mediaRule(mode, "img"),
    mediaRule(mode, "video"),
    mediaRule(mode, "canvas"),
    mediaRule(mode, "svg"),
    embeddedRule(mode, "iframe"),
    embeddedRule(mode, "embed"),
    embeddedRule(mode, "object"),
  ];
}
