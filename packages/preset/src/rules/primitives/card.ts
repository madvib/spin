import type { SpinRule } from "../../utils/lookup.ts";
import type { ThemeContext } from "../../utils/lookup.ts";
import type { ThemeType } from "@spinjs/theme/theme-types";
import { fallback, surfaceBlur } from "./shared.ts";

/**
 * Card — the compound primitive, as rules.
 *
 * Each part is a rule rather than a shortcut, because a shortcut emits a
 * CLASS selector and card is a tag vocabulary: `.card` matches nothing that
 * anyone writes. A rule sets `ctx.symbols.selector` and can claim the element
 * itself. Button established the shape; this is the same mechanism at seven
 * parts.
 *
 * uno keeps only the first rule matching a token, and each part is its own
 * token, so one rule per part is not merely convenient — it is the only
 * arrangement that cannot collide. A part therefore shakes: unused, it emits
 * nothing at all.
 *
 * Every declaration reads the theme. A token the theme omits is dropped
 * rather than emitted as a dangling `var()`, and a shorthand whose parts all
 * resolve is stated only when every one of them does.
 */
export function cardRules(roots: readonly string[]): SpinRule[] {
  if (!roots.includes("card")) return [];
  const card = "card";
  return [
    cardSurface(card),
    // Sizes are the card's own variants, not a layout attribute: a card that
    // is three-quarters of the measure is a decision about the card, and it
    // belongs where a consumer would look for it.
    cardSize(card, "card-narrow", "width-narrow"),
    cardSize(card, "card-default", "width"),
    cardSize(card, "card-wide", "width-wide"),
    cardGhost(card),
    cardFigure(),
    cardHeader(),
    cardTitle(),
    cardDescription(),
    cardAction(),
    cardContent(),
    cardFooter(),
  ];
}

function cardSize(
  card: string,
  utility: string,
  path: "width" | "width-narrow" | "width-wide",
): SpinRule {
  return [
    new RegExp(`^${utility}$`),
    function* (_m, ctx) {
      const max = ctx?.theme?.card?.[path];
      if (max === undefined) return;
      yield { [ctx.symbols.selector]: () => `${card}.${utility}`, width: "100%", "max-width": max };
    },
    { layer: "primitives", autocomplete: utility },
  ];
}

/** Shorthands resolved together, so a partial theme states nothing. */
type Tokens = {
  readonly spacing: string | undefined;
  readonly radius: string | undefined;
  readonly borderWidth: string | undefined;
  readonly border: string | undefined;
  readonly raised: string | undefined;
  readonly text: string | undefined;
  readonly muted: string | undefined;
  readonly title: ThemeType | undefined;
  readonly description: ThemeType | undefined;

  readonly shadow: string | undefined;
};

/**
 * The card's own tokens, and the shared scales they fall back to.
 *
 * A card's corner, its air, its edge and its elevation are the CARD's
 * decisions: a card is not a button, and a theme that squares its cards
 * while rounding its buttons has said something. Each one falls back to the
 * scale the card would otherwise wear, so a theme that says nothing about
 * the card's corner gets the page's radius — the theme's answer, never the
 * browser's.
 *
 * The card's type is two styles, never atoms: the title wears the card-title
 * style and the description the label style (the advisory small-medium
 * type), each read as a whole tuple, outright.
 */
function cardTokens(ctx: ThemeContext | undefined): Tokens {
  return {
    spacing: fallback(ctx?.theme?.card?.padding, ctx?.theme?.spacing?.[4]),
    radius: fallback(ctx?.theme?.card?.radius, ctx?.theme?.radius?.md),
    borderWidth: ctx?.theme?.border?.width,
    border: fallback(ctx?.theme?.card?.border, ctx?.theme?.color?.border),
    raised: ctx?.theme?.color?.["surface-raised"],
    text: ctx?.theme?.color?.text,
    muted: ctx?.theme?.color?.["text-muted"],
    title: ctx?.theme?.card?.title?.type ?? ctx?.theme?.font?.style?.title,
    description: ctx?.theme?.card?.description?.type ?? ctx?.theme?.font?.style?.label,

    shadow: fallback(ctx?.theme?.card?.elevation, ctx?.theme?.shadow?.md),
  };
}

/**
 * The surface: a column with a gap, raised, rounded, bordered, and elevated.
 *
 * The shadow is the card's own (`card.elevation`), spent on the surface and
 * dropped when the theme states none — a card that sits on the page rather
 * than above it is a theme decision, not a default. The step the card would
 * otherwise wear is the theme's resting one (`shadow.md`); a theme that
 * wants its cards louder states a louder `card.elevation` rather than the
 * card reaching for a bigger step. No transition is stated: the card is a
 * static surface with no state change of its own, so nothing moves. A hover
 * step is deliberately absent — a card is a container, not a control, and
 * the card-action child carries its own hover feedback.
 */
function cardSurface(card: string): SpinRule {
  return [
    /^card$/,
    function* (_m, ctx) {
      if (ctx.rawSelector !== undefined && ctx.rawSelector !== "card") {
        return;
      }
      const { spacing, radius, borderWidth, border, raised, shadow } =
        cardTokens(ctx);
      const blur = surfaceBlur(ctx);
      yield {
        [ctx.symbols.selector]: () => card,
        display: "flex",
        "flex-direction": "column",
        ...(spacing !== undefined ? { gap: spacing } : {}),
        ...(radius !== undefined ? { "border-radius": radius } : {}),
        ...(raised !== undefined ? { "background-color": raised } : {}),
        ...(blur !== undefined
          ? {
            "backdrop-filter": `blur(${blur})`,
            "-webkit-backdrop-filter": `blur(${blur})`,
          }
          : {}),
        ...(borderWidth !== undefined && border !== undefined
          ? { border: `${borderWidth} solid ${border}` }
          : {}),
        ...(shadow !== undefined ? { "box-shadow": shadow } : {}),
      };
      if (spacing !== undefined) {
        yield {
          [ctx.symbols.selector]: () =>
            `${card}:not(:has(> :is(card-header, card-content, card-footer, card-figure)))`,
          padding: spacing,
        };
      }
    },
    { layer: "primitives", autocomplete: "card" },
  ];
}

/**
 * The header: a two-column grid, so the text and the trailing action have
 * one job each.
 *
 * The row used to be a wrapping flex row, which put the action wherever the
 * title and description happened to end: a long description pushed a badge
 * onto a second line under the text, and a short one left the badge floating
 * mid-header. A grid states the relationship instead — the title and its
 * description share one column, and the action holds the trailing column on
 * the title's line. A header with no action leaves the second column empty;
 * a header with no description leaves the second row empty.
 */
function cardHeader(): SpinRule {
  return [
    /^card-header$/,
    function* (_m, ctx) {
      const { spacing } = cardTokens(ctx);
      const rowGap = ctx?.theme?.spacing?.[1];
      const header = "card-header";
      yield {
        [ctx.symbols.selector]: () => header,
        display: "grid",
        "grid-template-columns": "minmax(0, 1fr) auto",
        "align-items": "start",
        ...(spacing !== undefined ? { gap: spacing } : {}),
        ...(rowGap !== undefined ? { "row-gap": rowGap } : {}),
        ...(spacing !== undefined
          ? {
            "padding-inline-start": spacing,
            "padding-inline-end": spacing,
            "padding-block-start": spacing,
          }
          : {}),
      };
      if (spacing !== undefined) {
        yield {
          [ctx.symbols.selector]: () => `${header}:last-child`,
          "padding-block-end": spacing,
        };
      }
    },
    { layer: "primitives", autocomplete: "card-header" },
  ];
}

function cardTitle(): SpinRule {
  return [
    /^card-title$/,
    function* (_m, ctx) {
      const { title, text } = cardTokens(ctx);
      // The title wears the card-title style as a whole tuple — the name on
      // a card, set to be found inside a surface.
      yield {
        [ctx.symbols.selector]: () => "card-title",
        "grid-column": "1",
        "min-width": "0",
        ...(title ?? {}),
        ...(text !== undefined ? { color: text } : {}),
      };
    },
    { layer: "primitives", autocomplete: "card-title" },
  ];
}

function cardDescription(): SpinRule {
  return [
    /^card-description$/,
    function* (_m, ctx) {
      const { description, muted } = cardTokens(ctx);
      // The description wears the label style — the advisory small-medium
      // type, read outright.
      const size = description?.["font-size"];
      const weight = description?.["font-weight"];
      yield {
        [ctx.symbols.selector]: () => "card-description",
        "grid-column": "1",
        "min-width": "0",
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(weight !== undefined ? { "font-weight": weight } : {}),
        ...(muted !== undefined ? { color: muted } : {}),
      };
    },
    { layer: "primitives", autocomplete: "card-description" },
  ];
}

/**
 * The trailing slot. The grid's second column is what puts it on the title's
 * line — no auto margin, no dependence on the heading's width.
 *
 * It WRAPS, like the header it sits in: the slot holds controls, and a slot
 * of controls that is wider than the card pushes them out of it. A card that
 * cannot hold its own action is a card that is broken.
 */
function cardAction(): SpinRule {
  return [
    /^card-action$/,
    function* (_m, ctx) {
      const { spacing } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => "card-action",
        "grid-column": "2",
        "grid-row": "1",
        display: "flex",
        "flex-wrap": "wrap",
        "align-items": "center",
        ...(spacing !== undefined ? { gap: spacing } : {}),
      };
    },
    { layer: "primitives", autocomplete: "card-action" },
  ];
}

/** The body. Inline padding only — the surface owns the block spacing. */
function cardContent(): SpinRule {
  return [
    /^card-content$/,
    function* (_m, ctx) {
      const { spacing, text } = cardTokens(ctx);
      const content = "card-content";
      yield {
        [ctx.symbols.selector]: () => content,
        ...(spacing !== undefined
          ? {
            "padding-inline-start": spacing,
            "padding-inline-end": spacing,
          }
          : {}),
        ...(text !== undefined ? { color: text } : {}),
      };
      if (spacing !== undefined) {
        yield {
          [ctx.symbols.selector]: () => `${content}:first-child`,
          "padding-block-start": spacing,
        };
        yield {
          [ctx.symbols.selector]: () => `${content}:last-child`,
          "padding-block-end": spacing,
        };
      }
    },
    { layer: "primitives", autocomplete: "card-content" },
  ];
}

/**
 * The actions row. Closes the block padding the header and content opened.
 *
 * It WRAPS, and that is the whole of the fix. A card is a container and its
 * footer is part of the card: the two buttons in a footer are the card's
 * actions, and a footer that cannot hold them pushes them out of the surface
 * they belong to. The width a footer's actions need is the theme's own type
 * scale, so a theme with a wider scale would break every card in a narrow
 * column — the row that wraps is what keeps the card whole in all of them.
 */
function cardFooter(): SpinRule {
  return [
    /^card-footer$/,
    function* (_m, ctx) {
      const { spacing } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => "card-footer",
        display: "flex",
        "flex-wrap": "wrap",
        "align-items": "center",
        ...(spacing !== undefined ? { gap: spacing } : {}),
        ...(spacing !== undefined
          ? {
            "padding-inline-start": spacing,
            "padding-inline-end": spacing,
            "padding-block-end": spacing,
          }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "card-footer" },
  ];
}

/**
 * The ghost: a card with no chrome. Transparent, borderless, flat — the
 * parts keep their spacing but the surface disappears, for content that needs
 * grouping without a box. An author picks ghost OR a size, never both: a
 * maximum width on an invisible surface is a constraint with nothing to
 * constrain.
 */
function cardGhost(card: string): SpinRule {
  return [
    /^card-ghost$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => `${card}.card-ghost`,
        "background-color": "transparent",
        border: "none",
        "box-shadow": "none",
        "backdrop-filter": "none",
        "-webkit-backdrop-filter": "none",
      };
    },
    { layer: "primitives", autocomplete: "card-ghost" },
  ];
}

/**
 * The figure: a media slot that bleeds to the surface edge. No padding of
 * its own — the media fills it — with `overflow: hidden` so it keeps the
 * surface's corners. The author sizes the media with utilities (`w-full
 * block`); the figure owns only the bleed and the corners, so it claims no
 * element it does not own.
 */
function cardFigure(): SpinRule {
  return [
    /^card-figure$/,
    function* (_m, ctx) {
      const { radius } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => "card-figure",
        display: "block",
        overflow: "hidden",
        ...(radius !== undefined
          ? {
            "border-start-start-radius": radius,
            "border-start-end-radius": radius,
          }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "card-figure" },
  ];
}
