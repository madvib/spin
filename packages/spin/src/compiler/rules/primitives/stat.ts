import type { Rule } from "@unocss/core";
import { type ThemeContext, token } from "../../utils/lookup.ts";
import { styleReference, styleType, type StyleType } from "./shared.ts";

/** Stat — a labelled number, reading its voices from the named styles. */
export function statRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("stat")) return [];
  return [statRow(), statContainer(), statTitle(), statValue(), statDesc()];
}

/** The theme values stat spends, resolved once per rule. */
type Tokens = {
  readonly spacing2: string | undefined;
  readonly title: StyleType;
  readonly value: StyleType;
  readonly desc: StyleType;
  readonly text: string | undefined;
  readonly muted: string | undefined;
};

/**
 * The stat's own voices, each read as a whole style.
 *
 * The number reads the stat style outright: a figure set at the body's size
 * is a caption and a figure set like a poster is a lie, and the style is
 * the complete answer — face, size, weight, tracking, leading — rather than
 * atoms of the stat's own. The label above it reads the style the
 * `stat.title.type` reference names — the caption-strong voice unless the
 * theme re-points it — and the context under the number reads the caption
 * voice, the small print of the figure.
 */
function statTokens(ctx: ThemeContext | undefined): Tokens {
  const titleStyle = styleReference(ctx, "stat.title.type", "caption-strong") as string;
  return {
    spacing2: token(ctx, "spacing.2"),
    title: styleType(ctx, titleStyle),
    value: styleType(ctx, "stat"),
    desc: styleType(ctx, "caption"),
    text: token(ctx, "color.text"),
    muted: token(ctx, "color.text-muted"),
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
/** The label above the number: the style `stat.title.type` names, muted. */
function statTitle(): Rule {
  return [
    /^stat-title$/,
    function* (_m, ctx) {
      const { title, muted } = statTokens(ctx);
      const family = title.family;
      const size = title.size;
      const weight = title.weight;
      const tracking = title.tracking;
      const leading = title.leading;
      yield {
        [ctx.symbols.selector]: () => ".stat-title",
        ...(family !== undefined ? { "font-family": family } : {}),
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(muted !== undefined ? { color: muted } : {}),
        ...(weight !== undefined ? { "font-weight": weight } : {}),
        ...(tracking !== undefined ? { "letter-spacing": tracking } : {}),
        ...(leading !== undefined ? { "line-height": leading } : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat-title" },
  ];
}

/** The number itself: the stat voice, the largest type stat carries. */
function statValue(): Rule {
  return [
    /^stat-value$/,
    function* (_m, ctx) {
      const { value, text } = statTokens(ctx);
      const family = value.family;
      const size = value.size;
      const weight = value.weight;
      const tracking = value.tracking;
      const leading = value.leading;
      yield {
        [ctx.symbols.selector]: () => ".stat-value",
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(weight !== undefined ? { "font-weight": weight } : {}),
        // The face the number is set in, so a value's face is the theme's
        // decision and not whatever the page happened to set.
        ...(family !== undefined ? { "font-family": family } : {}),
        ...(tracking !== undefined ? { "letter-spacing": tracking } : {}),
        ...(leading !== undefined ? { "line-height": leading } : {}),
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

/** The context under the number, in the caption voice and the muted colour. */
function statDesc(): Rule {
  return [
    /^stat-desc$/,
    function* (_m, ctx) {
      const { desc, muted } = statTokens(ctx);
      const family = desc.family;
      const size = desc.size;
      const weight = desc.weight;
      const tracking = desc.tracking;
      const leading = desc.leading;
      yield {
        [ctx.symbols.selector]: () => ".stat-desc",
        ...(family !== undefined ? { "font-family": family } : {}),
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(weight !== undefined ? { "font-weight": weight } : {}),
        ...(tracking !== undefined ? { "letter-spacing": tracking } : {}),
        ...(leading !== undefined ? { "line-height": leading } : {}),
        ...(muted !== undefined ? { color: muted } : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat-desc" },
  ];
}
