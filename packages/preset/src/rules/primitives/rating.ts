import type { Rule } from "@unocss/core";
import { groupOf, themeOf } from "../../utils/lookup.ts";
import type { Mode } from "./shared.ts";

/**
 * Rating — five radios read as stars.
 *
 * A rating has no element of its own and needs none: the platform's radio
 * group already carries the value, the keyboard behaviour and the disabled
 * state, so a rating is a `.rating` container of five `.rating-star` radios
 * sharing a name. What CSS owns is the reading — the empty star, the filled
 * one, and the preview a hover paints before a click.
 *
 * **The direction is `row-reverse` meeting `~`.** The container lays its stars
 * out backwards, so DOM order 1..5 renders visually 5..1 — which makes a
 * LATER sibling a star further LEFT. `:checked ~ input` therefore selects
 * exactly the stars at or below the checked one in reading order, and no
 * inversion is needed: a checked star 3 paints DOM 3, 4 and 5, which is
 * visual 3, 2 and 1 — the visually-left two plus itself. Row-reverse is what
 * points the naive sibling combinator the right way.
 *
 * **The star is a radio wearing a different face, and that is the hard part.**
 * `radio.ts` draws every `input[type="radio"]` as a ring with a dot, at one
 * attribute selector of specificity — which a lone `.rating-star` cannot
 * beat, and a rating that loses that fight renders as five radios. So the
 * star's own selectors are qualified by the container: two classes clear both
 * the radio rule and the field box's `:is(input, select, textarea)`, and
 * still LOSE to the radio's `:checked`, `:disabled` and `:focus-visible` —
 * which is what keeps a disabled rating dimmed and a focused one ringed. The
 * dot is not hidden, it is un-generated: a pseudo-element paints nothing once
 * it has no content.
 *
 * **A filled star is a warning yellow.** The theme names its status colours by
 * meaning rather than by hue — success, warning, error, info — and the one
 * that means "notable, worth marking" is the one a lit star spends; a rating
 * is a judgement, and a judgement is an attention, not a brand colour. The
 * empty star is `text-muted`, the colour a caption takes, because an unrated
 * star is a placeholder for a mark.
 */
export function ratingRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("rating")) return [];
  return [ratingContainer(), ratingStar()];
}

/** The theme values a rating spends, resolved once per rule. */
function ratingTokens(ctx: Parameters<typeof themeOf>[0]) {
  const t = themeOf(ctx);
  return {
    gap: t?.spacing["1"],
    size: groupOf(ctx, "icon")["md"],
    muted: t?.colors["text-muted"],
    warning: t?.colors["semantic-warning"],
  };
}

/** The container: a row of stars, laid out in the direction the fill needs. */
function ratingContainer(): Rule {
  return [
    /^rating$/,
    function* (_m, ctx) {
      const { gap } = ratingTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".rating",
        display: "inline-flex",
        "flex-direction": "row-reverse",
        ...(gap !== undefined ? { gap } : {}),
      };
    },
    { layer: "primitives", autocomplete: "rating" },
  ];
}

/**
 * The star, its glyph, the dot it replaces, and the paint rules.
 *
 * All of it yields from one rule because uno keeps only the first rule
 * matching a token, and a document only ever writes `class="rating-star"` —
 * a second rule for the glyph would never fire, and the star would ship
 * without a shape.
 */
function ratingStar(): Rule {
  return [
    /^rating-star$/,
    function* (_m, ctx) {
      const { size, muted, warning } = ratingTokens(ctx);

      // The glyph. Its shape is content a reader recognises rather than a
      // value a theme chooses, so only the size and the colour are spent.
      const glyph: Record<string, string | undefined> = {
        content: '"★"',
        display: "block",
        "line-height": "1",
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(muted !== undefined ? { color: muted } : {}),
      };

      // The fill, for the value and for the preview alike: hovering star N
      // and having chosen star N are the same question, so they answer it
      // with the same declarations.
      const fill: Record<string, string | undefined> = {
        content: '"★"',
        ...(warning !== undefined ? { color: warning } : {}),
      };

      // Qualified by the container, so the star's own face outranks the radio
      // rule's while its states still reach it — see the file header.
      yield {
        [ctx.symbols.selector]: () => ".rating .rating-star",
        appearance: "none",
        // Five stars in a row is the whole control; none of them shrinks.
        flex: "none",
        cursor: "pointer",
        background: "none",
        border: "0",
        // The field box pads every input, and a star is a box of its own.
        padding: "0",
        ...(size !== undefined ? { width: size, height: size } : {}),
      };

      yield {
        [ctx.symbols.selector]: () => ".rating .rating-star::before",
        ...glyph,
      };

      // The radio's chrome, undone: no content, so no dot.
      yield {
        [ctx.symbols.selector]: () => ".rating .rating-star::after",
        content: "none",
      };

      // The value: the checked star and everything the container has put to
      // its left, which is every later sibling.
      yield {
        [ctx.symbols.selector]: () => "input.rating-star:checked::before",
        ...fill,
      };
      yield {
        [ctx.symbols.selector]: () =>
          "input.rating-star:checked ~ input.rating-star::before",
        ...fill,
      };

      // The preview: the same fill, one state earlier.
      yield {
        [ctx.symbols.selector]: () => "input.rating-star:hover::before",
        ...fill,
      };
      yield {
        [ctx.symbols.selector]: () =>
          "input.rating-star:hover ~ input.rating-star::before",
        ...fill,
      };
    },
    { layer: "primitives", autocomplete: "rating-star" },
  ];
}
