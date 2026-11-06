import type { SpinRule } from "../../utils/lookup.ts";
import { proseTokens, spacing } from "./shared.ts";
import { paintedTag } from "./scope.ts";

/**
 * Embedded media: `figure`, `figcaption`, the raster and vector elements, and
 * the frame elements.
 *
 * The only part of prose that brings its own box. Everything else is a run of
 * text inside the reader's column; a figure has edges, a caption has its own
 * spacing, and an embed has a size the document does not otherwise impose.
 */

/**
 * A figure.
 *
 * Two treatments, and they belong to different owners.
 *
 * The figure's RHYTHM — the gap it leaves in the flow — is typography, and
 * typography is the theme's everywhere.
 *
 * The figure's BOX — the media it holds and the caption under it — is the
 * document's furniture: the document says how a figure is set, and a figure
 * outside a document column is only a block of flow.
 */
function figureRule(): SpinRule {
  return [
    /^figure$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => "figure",
        ...spacing(proseTokens(ctx)),
      };
      yield {
        [ctx.symbols.selector]: () =>
          paintedTag("prose", "descendant", "figure"),
        "margin-inline": "0",
      };
    },
    { layer: "primitives", autocomplete: "figure" },
  ];
}

/**
 * A caption.
 *
 * Its TYPE — the caption-strong style it reads in — is typography, and the
 * theme's everywhere: a caption is a caption wherever it sits. A theme moves
 * its captions by moving the style.
 *
 * Its PLACE — centred under the figure it belongs to — is the document's
 * furniture, because a caption is centred in a column and nowhere else.
 */
function figcaptionRule(): SpinRule {
  return [
    /^figcaption$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const primary = ctx?.theme?.element?.figcaption?.type;
      const shared = ctx?.theme?.font?.style?.["caption-strong"];
      const s = primary ?? shared;
      yield {
        [ctx.symbols.selector]: () => "figcaption",
        // The gap the caption leaves under the figure it belongs to: the
        // caption's own spacing, and the theme's.
        ...(t.spacing1 !== undefined
          ? { "margin-block-start": t.spacing1 }
          : {}),
        ...(s ?? {}),
        ...(t.muted !== undefined ? { color: t.muted } : {}),
      };
      yield {
        [ctx.symbols.selector]: () =>
          paintedTag("prose", "descendant", "figcaption"),
        "text-align": "center",
      };
    },
    { layer: "primitives", autocomplete: "figcaption" },
  ];
}

/** Media never overflows its column, and raster/video carry the card's corner. */
function mediaRule(tag: string): SpinRule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => paintedTag("prose", "descendant", tag),
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

function embeddedRule(tag: string): SpinRule {
  return [
    new RegExp(`^${tag}$`),
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => paintedTag("prose", "descendant", tag),
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

export function mediaRules(): SpinRule[] {
  return [
    figureRule(),
    figcaptionRule(),
    mediaRule("img"),
    mediaRule("video"),
    mediaRule("canvas"),
    mediaRule("svg"),
    embeddedRule("iframe"),
    embeddedRule("embed"),
    embeddedRule("object"),
  ];
}
