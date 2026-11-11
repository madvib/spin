import type { SpinRule, ThemeContext } from "../../utils/lookup.ts";
import { fallback } from "./shared.ts";

/**
 * Skeleton — the CSS-only loader: a placeholder block that pulses.
 *
 * A skeleton is class-entry, and no bare element means "the content has not
 * arrived yet", so there is no tag claim to make.
 */
export function skeletonRules(roots: readonly string[]): SpinRule[] {
  if (!roots.includes("skeleton")) return [];
  return [block(), textLine(), circle()];
}

/** The theme values a skeleton spends, resolved once per rule. */
function tokens(ctx: ThemeContext | undefined) {
  // The text line stands in for one line of body copy, so its height is the
  // body style's size, read through the style outright.
  const body = ctx?.theme?.font?.style?.body;
  return {
    well: ctx?.theme?.color?.["surface-sunken"],
    ink: ctx?.theme?.color?.["text-muted"],
    radiusSm: ctx?.theme?.radius?.sm,
    radiusFull: ctx?.theme?.radius?.full,
    spacing2: ctx?.theme?.spacing?.[2],
    textSize: body?.["font-size"],
    // Static: `md` is a fixed step name, not a class suffix.
    avatar: ctx?.theme?.avatar?.md,
    // The LOOP step, not the slowest transition: a loader is watched rather
    // than reacted to, so its period is a step of its own. A theme that
    // declares no loop falls back to its slowest transition, which is the
    // answer the system had before the loop step existed.
    duration: fallback(ctx?.theme?.motion?.duration?.loop, ctx?.theme?.motion?.duration?.slow),
    easing: ctx?.theme?.motion?.easing?.standard,
  };
}

/**
 * The block — the placeholder itself.
 *
 * The sunken well mixed toward the muted ink, not `field`: a placeholder is
 * the hole the content has not filled yet, and on the light starters the
 * field is white on a near-white page — invisible. The mix keeps the block
 * legible on a tinted surface without minting a new token.
 */
function block(): SpinRule {
  return [
    /^skeleton$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      const fill = t.well !== undefined && t.ink !== undefined
        ? `color-mix(in oklab, ${t.well} 88%, ${t.ink})`
        : t.well;
      yield {
        [ctx.symbols.selector]: () => ".skeleton",
        display: "block",
        ...(fill !== undefined ? { "background-color": fill } : {}),
        ...(t.radiusSm !== undefined ? { "border-radius": t.radiusSm } : {}),
        // Both halves of the timing come from the motion scale, so a theme
        // without motion has a skeleton that holds still rather than one
        // animating at a duration no theme chose. The period is the LOOP
        // step: a loader is watched, not reacted to, and at 150ms the pulse
        // reads as a flicker.
        ...(t.duration !== undefined && t.easing !== undefined
          ? {
            animation: `spin-skeleton-pulse ${t.duration} ${t.easing} infinite`,
          }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "skeleton" },
  ];
}

/**
 * The text line — a placeholder for one line of copy.
 *
 * The height is the size of the text it stands in for, so a loading paragraph
 * occupies the line boxes the paragraph will occupy and the page does not
 * reflow when the words land. The full radius keeps a 14px bar a bar, and the
 * trailing space is the theme's own, so stacked lines carry the spacing the
 * real text will carry.
 */
function textLine(): SpinRule {
  return [
    /^skeleton-text$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".skeleton.skeleton-text",
        width: "100%",
        // A line with no width paints nothing: the placeholder's width is
        // the line's own (full measure by default, narrowed by the
        // consumer's `w-*`), so an unwidthed example still paints.
        ...(t.textSize !== undefined ? { height: t.textSize } : {}),
        ...(t.radiusFull !== undefined
          ? { "border-radius": t.radiusFull }
          : {}),
        ...(t.spacing2 !== undefined ? { "margin-block-end": t.spacing2 } : {}),
      };
    },
  ];
}

/**
 * The circle — a placeholder for a face.
 *
 * A disc placeholder is an avatar, the one thing a circle stands for, so its
 * edge is read from the avatar token rather than minted from the spacing
 * scale: a loading face and a real one fill the same square, and the swap
 * between them moves nothing.
 */
function circle(): SpinRule {
  return [
    /^skeleton-circle$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".skeleton.skeleton-circle",
        ...(t.avatar !== undefined
          ? { width: t.avatar, height: t.avatar }
          : {}),
        ...(t.radiusFull !== undefined
          ? { "border-radius": t.radiusFull }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "skeleton-circle" },
  ];
}
