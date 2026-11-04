import type { Rule } from "@unocss/core";
import { type ThemeContext, token } from "../../utils/lookup.ts";
import { withFallback } from "./shared.ts";

/** Stat — a labelled number, sized and coloured by the type ladder. */
export function statRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("stat")) return [];
  return [statRow(), statContainer(), statTitle(), statValue(), statDesc()];
}

/** The theme values stat spends, resolved once per rule. */
type Tokens = {
  readonly spacing2: string | undefined;
  readonly sizeXs: string | undefined;
  readonly sizeSm: string | undefined;
  readonly size2xl: string | undefined;
  readonly weightSemibold: string | undefined;
  /** The weight of the number, which is the stat's own decision. */
  readonly valueWeight: string | undefined;
  /** The face the number is set in, which is the stat's own decision. */
  readonly valueFamily: string | undefined;
  readonly text: string | undefined;
  readonly muted: string | undefined;
  readonly trackingWide: string | undefined;
};

/**
 * The stat's own tokens, and the scales they fall back to.
 *
 * The number is the stat's: its size and its weight are the stat's own
 * decisions, because a figure set at the body's size is a caption and a
 * figure set like a poster is a lie. Each falls back to the step the stat
 * would otherwise wear, so a theme that says nothing about the number gets
 * the type scale's answer rather than the browser's. The label above it
 * keeps the scale's weight: a label is prose, and prose wears the prose
 * weight.
 */
function statTokens(ctx: ThemeContext | undefined): Tokens {
  return {
    spacing2: token(ctx, "spacing.2"),
    sizeXs: token(ctx, "font.size.xs"),
    sizeSm: token(ctx, "font.size.sm"),
    size2xl: withFallback(ctx, "stat.value-size", "font.size.2xl"),
    weightSemibold: token(ctx, "font.weight.semibold"),
    valueWeight: withFallback(ctx, "stat.value-weight", "font.weight.semibold"),
    // The face the number is set in: the stat's own decision, because a
    // figure is a figure and the face it is set in belongs to the number
    // rather than to the page it sits on. The mono is the system's answer —
    // the face that carries figures, and whose digits line up.
    valueFamily: withFallback(ctx, "stat.value-family", "font.family.mono"),
    text: token(ctx, "color.text"),
    muted: token(ctx, "color.text-muted"),
    trackingWide: token(ctx, "font.letter-spacing.wide"),
  };
}

/**
 * The row a stat sits in.
 *
 * The stat is a class-entry composite, so its row is a class as well — the
 * same shape the card's parts have, spoken in the vocabulary a class-entry
 * composite can speak.
 *
 * The row WRAPS, and this is the fix for a defect the type scale caused: the
 * width a row of stats needs is the theme's own type scale, and nothing else
 * absorbs the difference. A theme with a larger scale made a row of three
 * stats wider than the column it was given, and the row did not wrap — so the
 * browser shrank the stats instead, and the numbers broke and the
 * descriptions wrapped. A row that wraps keeps every stat whole: the third
 * stat moves to the next line, and the numbers on the first line are the
 * size the theme says they are.
 *
 * The items sit on the shared top edge, because a row of stats is a row of
 * LABELS: the titles have to line up, and a stat centred against a taller
 * neighbour puts its title below the others'.
 */
function statRow(): Rule {
  return [
    /^stat-row$/,
    function* (_m, ctx) {
      const { spacing2 } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat-row",
        display: "flex",
        "flex-wrap": "wrap",
        "align-items": "start",
        ...(spacing2 !== undefined ? { gap: spacing2 } : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat-row" },
  ];
}

/** The container: a flex column with a gap between the parts. */
function statContainer(): Rule {
  return [
    /^stat$/,
    function* (_m, ctx) {
      const { spacing2 } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat",
        display: "flex",
        "flex-direction": "column",
        ...(spacing2 !== undefined ? { gap: spacing2 } : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat" },
  ];
}

/** The label above the number: small, muted, semibold. */
function statTitle(): Rule {
  return [
    /^stat-title$/,
    function* (_m, ctx) {
      const { sizeXs, muted, weightSemibold, trackingWide } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat-title",
        ...(sizeXs !== undefined ? { "font-size": sizeXs } : {}),
        ...(muted !== undefined ? { color: muted } : {}),
        ...(weightSemibold !== undefined
          ? { "font-weight": weightSemibold }
          : {}),
        ...(trackingWide !== undefined
          ? { "letter-spacing": trackingWide }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat-title" },
  ];
}

/** The number itself: the largest type stat carries. */
function statValue(): Rule {
  return [
    /^stat-value$/,
    function* (_m, ctx) {
      const { size2xl, valueWeight, valueFamily, text } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat-value",
        ...(size2xl !== undefined ? { "font-size": size2xl } : {}),
        ...(valueWeight !== undefined ? { "font-weight": valueWeight } : {}),
        // The face the number is set in, so a value's face is the theme's
        // decision and not whatever the page happened to set.
        ...(valueFamily !== undefined ? { "font-family": valueFamily } : {}),
        ...(text !== undefined ? { color: text } : {}),
        // The number is ONE thing. A stat squeezed by a row too narrow for it
        // breaks its figure across two lines, and a figure split in half is
        // not a figure — so the figure does not break, whatever the row it
        // sits in does.
        "white-space": "nowrap",
      };
    },
    { layer: "primitives", autocomplete: "stat-value" },
  ];
}

/** The context under the number, in the muted colour. */
function statDesc(): Rule {
  return [
    /^stat-desc$/,
    function* (_m, ctx) {
      const { sizeSm, muted } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat-desc",
        ...(sizeSm !== undefined ? { "font-size": sizeSm } : {}),
        ...(muted !== undefined ? { color: muted } : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat-desc" },
  ];
}
