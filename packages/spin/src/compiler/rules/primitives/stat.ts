import type { SpinRule } from "../../utils/lookup.ts";
import type { ThemeContext } from "../../utils/lookup.ts";
import type { Theme, ThemeType } from "../../../theme/theme-types.d.ts";

/** Stat — a labelled number, reading its styles from the named styles. */
export function statRules(roots: readonly string[]): SpinRule[] {
  if (!roots.includes("stat")) return [];
  return [statRow(), statContainer(), statTitle(), statValue(), statDesc()];
}

/** The theme values stat spends, resolved once per rule. */
type Tokens = {
  readonly spacing2: string | undefined;
  readonly title: ThemeType | undefined;
  readonly value: ThemeType | undefined;
  readonly desc: ThemeType | undefined;
  readonly text: string | undefined;
  readonly muted: string | undefined;
};

/**
 * The stat's own styles, each read as a whole tuple.
 *
 * The number reads the stat style outright: a figure set at the body's size
 * is a caption and a figure set like a poster is a lie, and the style is
 * the complete answer — face, size, weight, tracking, leading — rather than
 * atoms of the stat's own. The label above it reads `stat.title.type` —
 * the caption-strong style unless the theme declares its own title — and
 * the context under the number reads the caption style, the small print
 * of the figure.
 */
function statTokens(ctx: ThemeContext | undefined): Tokens {
  const theme: Theme | undefined = ctx?.theme;
  // The label above the number reads `stat.title.type`, falling back to the
  // caption-strong style when the theme declares no title of its own.
  const title = theme?.stat?.title?.type
    ?? theme?.font?.style?.["caption-strong"];
  return {
    spacing2: ctx?.theme?.spacing?.[2],
    title,
    value: theme?.stat?.value?.type ?? theme?.font?.style?.stat,
    desc: theme?.stat?.desc?.type ?? theme?.font?.style?.caption,
    text: ctx?.theme?.color?.text,
    muted: ctx?.theme?.color?.["text-muted"],
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
function statRow(): SpinRule {
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
function statContainer(): SpinRule {
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
/** The label above the number: the stat title tuple, muted. */
function statTitle(): SpinRule {
  return [
    /^stat-title$/,
    function* (_m, ctx) {
      const { title, muted } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat-title",
        ...(title ?? {}),
        ...(muted !== undefined ? { color: muted } : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat-title" },
  ];
}

/** The number itself: the stat style, the largest type stat carries. */
function statValue(): SpinRule {
  return [
    /^stat-value$/,
    function* (_m, ctx) {
      const { value, text } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat-value",
        ...(value ?? {}),
        // The face the number is set in, so a value's face is the theme's
        // decision and not whatever the page happened to set.
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

/** The context under the number, in the caption style and the muted colour. */
function statDesc(): SpinRule {
  return [
    /^stat-desc$/,
    function* (_m, ctx) {
      const { desc, muted } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat-desc",
        ...(desc ?? {}),
        ...(muted !== undefined ? { color: muted } : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat-desc" },
  ];
}
