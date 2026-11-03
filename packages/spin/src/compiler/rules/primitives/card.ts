import type { Rule } from "@unocss/core";
import { type ThemeContext, token } from "../../utils/lookup.ts";
import { claim, type Mode, withFallback } from "./shared.ts";

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
export function cardRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("card")) return [];
  const card = claim(mode, "card");
  return [
    cardSurface(card),
    // Sizes are the card's own variants, not a layout attribute: a card that
    // is three-quarters of the measure is a decision about the card, and it
    // belongs where a consumer would look for it.
    ...CARD_SIZES.map((size) => cardSize(card, size)),
    cardGhost(card),
    cardFigure(mode),
    cardHeader(mode),
    cardTitle(mode),
    cardDescription(mode),
    cardAction(mode),
    cardContent(mode),
    cardFooter(mode),
  ];
}

/**
 * The widths a card is offered at.
 *
 * Structural variants rather than tones: a size changes the card's own box,
 * not what colour it is. Three steps is a floor — a card in a narrow column,
 * a card at the page's measure, and a card spanning a grid — and each is a
 * maximum rather than a fixed width, so a card in a narrower parent still
 * shrinks instead of overflowing.
 *
 * The values are literals, not theme tokens: the theme has no measure or
 * component-width scale, and its breakpoint scale is for viewport widths, not
 * for the boxes inside them. A card's width is a layout decision — how much
 * of the page a surface may occupy — not a theme decision like colour or
 * spacing. Inventing a token for it would be a scale nothing else reads.
 */
const CARD_SIZES: ReadonlyArray<readonly [name: string, max: string]> = [
  ["card-narrow", "24rem"],
  ["card-default", "32rem"],
  ["card-wide", "48rem"],
];

function cardSize(card: string, [name, max]: readonly [string, string]): Rule {
  return [
    new RegExp(`^${name}$`),
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => `${card}.${name}`,
        width: "100%",
        "max-width": max,
      };
    },
    { layer: "primitives", autocomplete: name },
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
  readonly sizeLg: string | undefined;
  readonly sizeSm: string | undefined;
  readonly weightSemibold: string | undefined;

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
 */
function cardTokens(ctx: ThemeContext | undefined): Tokens {
  return {
    spacing: withFallback(ctx, "card.padding", "spacing.4"),
    radius: withFallback(ctx, "card.radius", "radius.md"),
    borderWidth: token(ctx, "border.width"),
    border: withFallback(ctx, "card.border", "color.border"),
    raised: token(ctx, "color.surface-raised"),
    text: token(ctx, "color.text"),
    muted: token(ctx, "color.text-muted"),
    sizeLg: token(ctx, "font.size.lg"),
    sizeSm: token(ctx, "font.size.sm"),
    weightSemibold: token(ctx, "font.weight.semibold"),

    shadow: withFallback(ctx, "card.elevation", "shadow.md"),
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
function cardSurface(card: string): Rule {
  return [
    /^card$/,
    function* (_m, ctx) {
      if (
        ctx.rawSelector !== undefined &&
        ctx.rawSelector !== "card" &&
        ctx.rawSelector !== ".card"
      ) {
        return;
      }
      const { spacing, radius, borderWidth, border, raised, shadow } =
        cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => card,
        display: "flex",
        "flex-direction": "column",
        ...(spacing !== undefined ? { gap: spacing } : {}),
        ...(radius !== undefined ? { "border-radius": radius } : {}),
        ...(raised !== undefined ? { "background-color": raised } : {}),
        ...(borderWidth !== undefined && border !== undefined
          ? { border: `${borderWidth} solid ${border}` }
          : {}),
        ...(shadow !== undefined ? { "box-shadow": shadow } : {}),
      };
      if (spacing !== undefined) {
        yield {
          [ctx.symbols.selector]: () =>
            `${card}:not(:has(> :is(card-header, card-content, card-footer, card-figure, .card-header, .card-content, .card-footer, .card-figure)))`,
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
function cardHeader(mode: Mode): Rule {
  return [
    /^card-header$/,
    function* (_m, ctx) {
      const { spacing } = cardTokens(ctx);
      const rowGap = token(ctx, "spacing.1");
      const header = claim(mode, "card-header");
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

function cardTitle(mode: Mode): Rule {
  return [
    /^card-title$/,
    function* (_m, ctx) {
      const { sizeLg, weightSemibold, text } = cardTokens(ctx);
      const headingFamily = withFallback(ctx, "font.family.heading", "font.family.sans");
      yield {
        [ctx.symbols.selector]: () => claim(mode, "card-title"),
        "grid-column": "1",
        "min-width": "0",
        ...(headingFamily !== undefined
          ? { "font-family": headingFamily }
          : {}),
        ...(sizeLg !== undefined ? { "font-size": sizeLg } : {}),
        ...(weightSemibold !== undefined
          ? { "font-weight": weightSemibold }
          : {}),
        ...(text !== undefined ? { color: text } : {}),
      };
    },
    { layer: "primitives", autocomplete: "card-title" },
  ];
}

function cardDescription(mode: Mode): Rule {
  return [
    /^card-description$/,
    function* (_m, ctx) {
      const { sizeSm, muted } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "card-description"),
        "grid-column": "1",
        "min-width": "0",
        ...(sizeSm !== undefined ? { "font-size": sizeSm } : {}),
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
function cardAction(mode: Mode): Rule {
  return [
    /^card-action$/,
    function* (_m, ctx) {
      const { spacing } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "card-action"),
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
function cardContent(mode: Mode): Rule {
  return [
    /^card-content$/,
    function* (_m, ctx) {
      const { spacing, text } = cardTokens(ctx);
      const content = claim(mode, "card-content");
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
function cardFooter(mode: Mode): Rule {
  return [
    /^card-footer$/,
    function* (_m, ctx) {
      const { spacing } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "card-footer"),
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
function cardGhost(card: string): Rule {
  return [
    /^card-ghost$/,
    function* (_m, ctx) {
      yield {
        [ctx.symbols.selector]: () => `${card}.card-ghost`,
        "background-color": "transparent",
        border: "none",
        "box-shadow": "none",
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
function cardFigure(mode: Mode): Rule {
  return [
    /^card-figure$/,
    function* (_m, ctx) {
      const { radius } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "card-figure"),
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
