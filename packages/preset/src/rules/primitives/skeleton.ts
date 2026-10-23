import type { Rule } from "@unocss/core";
import { named, type ThemeContext, token } from "../../utils/lookup.ts";
import { type Mode, withFallback } from "./shared.ts";

/**
 * Skeleton — the CSS-only loader: a placeholder block that pulses.
 *
 * `_mode` is accepted for the shared rule shape and unused: a skeleton is
 * class-entry, and no bare element means "the content has not arrived yet",
 * so there is no classless claim for a classless build to make.
 */
export function skeletonRules(roots: readonly string[], _mode: Mode): Rule[] {
  if (!roots.includes("skeleton")) return [];
  return [block(), textLine(), circle()];
}

/** The theme values a skeleton spends, resolved once per rule. */
function tokens(ctx: ThemeContext | undefined) {
  return {
    field: token(ctx, "color.field"),
    radiusSm: token(ctx, "radius.sm"),
    radiusFull: token(ctx, "radius.full"),
    spacing2: token(ctx, "spacing.2"),
    textSize: token(ctx, "font.size.sm"),
    // A disc placeholder is a face, so its edge is the avatar ladder's.
    avatar: named(ctx, "avatar", "md"),
    // The LOOP step, not the slowest transition: a loader is watched rather
    // than reacted to, so its period is a step of its own. A theme that
    // declares no loop falls back to its slowest transition, which is the
    // answer the system had before the loop step existed.
    duration: withFallback(ctx, "motion.duration.loop", "motion.duration.slow"),
    easing: token(ctx, "motion.easing.standard"),
  };
}

/**
 * The block — the placeholder itself.
 *
 * `field`, not `surface-raised`: a placeholder is the inset surface a control
 * takes, the hole the content has not filled yet. A raised block would read
 * as content that already arrived.
 */
function block(): Rule {
  return [
    /^skeleton$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".skeleton",
        display: "block",
        ...(t.field !== undefined ? { "background-color": t.field } : {}),
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
function textLine(): Rule {
  return [
    /^skeleton-text$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".skeleton.skeleton-text",
        ...(t.textSize !== undefined ? { height: t.textSize } : {}),
        ...(t.radiusFull !== undefined
          ? { "border-radius": t.radiusFull }
          : {}),
        ...(t.spacing2 !== undefined ? { "margin-block-end": t.spacing2 } : {}),
      };
    },
    { layer: "primitives", autocomplete: "skeleton-text" },
  ];
}

/**
 * The circle — a placeholder for a face.
 *
 * A disc placeholder is an avatar, the one thing a circle stands for, so its
 * edge is read from the avatar ladder rather than minted from the spacing
 * scale: a loading face and a real one fill the same square, and the swap
 * between them moves nothing.
 */
function circle(): Rule {
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
