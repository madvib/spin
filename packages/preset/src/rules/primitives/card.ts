import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

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

function cardTokens(ctx: Parameters<typeof themeOf>[0]): Tokens {
  const t = themeOf(ctx);
  return {
    spacing: t?.spacing?.["4"],
    radius: t?.radius?.["lg"],
    borderWidth: t?.borderWidth?.["width"],
    border: t?.colors?.["border"],
    raised: t?.colors?.["surface-raised"],
    text: t?.colors?.["text"],
    muted: t?.colors?.["text-muted"],
    sizeLg: t?.fontSize?.["lg"],
    sizeSm: t?.fontSize?.["sm"],
    weightSemibold: t?.fontWeight?.["semibold"],

    shadow: t?.shadow?.["lg"],
  };
}

/**
 * The surface: a column with a gap, raised, rounded, bordered, and elevated.
 *
 * The shadow is the theme's own elevation scale (`shadow.lg`), spent on the
 * surface and dropped when the theme states none — a card that sits on the
 * page rather than above it is a theme decision, not a default. No transition
 * is stated: the card is a static surface with no state change of its own, so
 * nothing moves. A hover step is deliberately absent — a card is a container,
 * not a control, and the card-action child carries its own hover feedback.
 */
function cardSurface(card: string): Rule {
  return [
    /^card$/,
    function* (_m, ctx) {
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
    },
    { layer: "primitives", autocomplete: "card" },
  ];
}

/**
 * The header: a wrapping row so a long title and a trailing action share a
 * line without either forcing the other to wrap.
 */
function cardHeader(mode: Mode): Rule {
  return [
    /^card-header$/,
    function* (_m, ctx) {
      const { spacing } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "card-header"),
        display: "flex",
        "flex-wrap": "wrap",
        "align-items": "center",
        ...(spacing !== undefined ? { gap: spacing } : {}),
        ...(spacing !== undefined
          ? {
            "padding-inline-start": spacing,
            "padding-inline-end": spacing,
            "padding-block-start": spacing,
          }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "card-header" },
  ];
}

function cardTitle(mode: Mode): Rule {
  return [
    /^card-title$/,
    function* (_m, ctx) {
      const { sizeLg, weightSemibold, text } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "card-title"),
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
        ...(sizeSm !== undefined ? { "font-size": sizeSm } : {}),
        ...(muted !== undefined ? { color: muted } : {}),
      };
    },
    { layer: "primitives", autocomplete: "card-description" },
  ];
}

/**
 * The trailing slot. The auto inline-start margin is what pushes it to the
 * end of the header's row — the one value in card that is a keyword rather
 * than a token, because no theme states how far a header's action sits.
 */
function cardAction(mode: Mode): Rule {
  return [
    /^card-action$/,
    function* (_m, ctx) {
      const { spacing } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "card-action"),
        display: "flex",
        "align-items": "center",
        "margin-inline-start": "auto",
        ...(spacing !== undefined ? { gap: spacing } : {}),
      };
    },
    { layer: "primitives", autocomplete: "card-action" },
  ];
}

/** The body. Inline padding only — the surface owns the block rhythm. */
function cardContent(mode: Mode): Rule {
  return [
    /^card-content$/,
    function* (_m, ctx) {
      const { spacing, text } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "card-content"),
        ...(spacing !== undefined
          ? {
            "padding-inline-start": spacing,
            "padding-inline-end": spacing,
          }
          : {}),
        ...(text !== undefined ? { color: text } : {}),
      };
    },
    { layer: "primitives", autocomplete: "card-content" },
  ];
}

/** The actions row. Closes the block padding the header and content opened. */
function cardFooter(mode: Mode): Rule {
  return [
    /^card-footer$/,
    function* (_m, ctx) {
      const { spacing } = cardTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "card-footer"),
        display: "flex",
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
 * parts keep their rhythm but the surface disappears, for content that needs
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
