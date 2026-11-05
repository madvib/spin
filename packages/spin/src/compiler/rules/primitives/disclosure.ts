import type { Rule } from "@unocss/core";
import { type ThemeContext, token } from "../../utils/lookup.ts";
import { ladder, styleType, type StyleType } from "./shared.ts";

/**
 * Disclosure — `<details>` and `<summary>`.
 *
 * A native element with a real open state, which is why it is a rule rather
 * than a class: there is a state to style, and no JavaScript needed to reach
 * it. The platform owns the behaviour — a disclosure works with scripting
 * disabled, is keyboard operable, and is announced through its native role —
 * so everything here is the surface and none of it is the mechanism.
 *
 * Four opinions, and the fourth is about motion:
 *
 * **The marker is ours.** The platform triangle is the one part of a native
 * disclosure that looks the same in every browser and belongs to none of them.
 * It is hidden and drawn again as a chevron, so the indicator is the same shape
 * as every other icon in the system and can be themed like one.
 *
 * **The rotation is the state.** A chevron that turns reads as open or closed
 * without the reader needing to parse the angle, and it reads correctly at any
 * size because it scales with the glyph. Two triangles that swap do not.
 *
 * **Only the marker turns.** Rotating the row moves the label's baseline, which
 * reads as the row shifting rather than as a control opening. The label stays
 * put and the indicator moves.
 *
 * **The reveal is the platform's, too.** The content box is `::details-content`
 * and the platform toggles it in place, so the body can grow and shrink in
 * place — no JavaScript, no wrapper, and no layout shift beyond the reveal
 * itself. What is ours is the pair of states the transition interpolates.
 */
export function disclosureRules(
  roots: readonly string[],
): Rule[] {
  if (!roots.includes("details")) return [];
  const details = "details";
  const summary = "summary";
  return [detailsRule(details, summary), summaryRule(summary, details)];
}

interface Tokens {
  readonly spacing2: string | undefined;
  readonly radius: string | undefined;
  readonly radiusSm: string | undefined;
  readonly text: string | undefined;
  readonly muted: string | undefined;
  readonly raised: string | undefined;
  readonly sunken: string | undefined;
  readonly border: string | undefined;
  readonly borderWidth: string | undefined;
  readonly weightSemibold: StyleType;
  readonly focusWidth: string | undefined;
  readonly focusOffset: string | undefined;
  readonly focusRing: string | undefined;
  readonly duration: string | undefined;
  readonly easing: string | undefined;
  /** The reveal's duration: a whole block entering, so a step slower. */
  readonly reveal: string | undefined;
  /** The reveal's curve: content enters fast and settles. */
  readonly easeOut: string | undefined;
}

function tokens(ctx: ThemeContext | undefined): Tokens {
  return {
    spacing2: token(ctx, "spacing.2"),
    radius: token(ctx, "radius.md"),
    radiusSm: token(ctx, "radius.sm"),
    text: token(ctx, "color.text"),
    muted: token(ctx, "color.text-muted"),
    raised: token(ctx, "color.surface-raised"),
    sunken: token(ctx, "color.surface-sunken"),
    border: token(ctx, "color.border"),
    borderWidth: token(ctx, "border.width"),
    weightSemibold: styleType(ctx, "body-strong"),
    focusWidth: token(ctx, "focus.width"),
    focusOffset: token(ctx, "focus.offset"),
    focusRing: token(ctx, "color.focus-ring"),
    duration: token(ctx, "motion.duration.fast"),
    easing: token(ctx, "motion.easing.standard"),
    reveal: token(ctx, "motion.duration.base"),
    easeOut: token(ctx, "motion.easing.decelerate"),
  };
}

/** The container: a surface with a rule, and none of its own state. */
function detailsRule(details: string, summary: string): Rule {
  return [
    /^details$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => details,
        // The reveal interpolates a keyword — the content's natural height —
        // and a keyword only interpolates when the element says so. The
        // property is inherited, so stating it here lets the content box
        // below spend `auto` as a length rather than as a jump.
        "interpolate-size": "allow-keywords",
        // A disclosure is a block-width surface, not a box sized by its
        // summary. Left to its content it is narrow while closed and wide
        // while open, so opening one pulled the line sideways; the width is
        // the line's, and the reveal moves only vertically.
        "inline-size": "100%",
        "min-inline-size": "0",
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { border: `${t.borderWidth} solid ${t.border}` }
          : {}),
        ...(t.radius !== undefined ? { "border-radius": t.radius } : {}),
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
      };
      // The body is inset from the label so the content reads as belonging to
      // it rather than as a sibling that happens to sit underneath. Only the
      // sides and bottom carry padding — the summary above owns the top gap,
      // so opening adds no space above the body, only below the label. Direct
      // children only: a nested disclosure is itself a card, not body text.
      yield {
        [ctx.symbols.selector]: () => `${details} > :not(${summary}):not(${details})`,
        ...(t.spacing2 !== undefined
          ? {
            "padding-inline-start": t.spacing2,
            "padding-inline-end": t.spacing2,
            "padding-block-end": t.spacing2,
          }
          : {}),
      };
      // A nested disclosure hangs off the parent's full measure — edge to
      // edge, like any block child — so the parent's side padding does not
      // frame it as a pill inside the body.
      yield {
        [ctx.symbols.selector]: () => `${details} ${details}`,
        ...(t.spacing2 !== undefined
          ? {
            "margin-inline-start": `calc(-1 * ${t.spacing2})`,
            "margin-inline-end": `calc(-1 * ${t.spacing2})`,
          }
          : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${details} > ${details}:last-child`,
        ...(t.spacing2 !== undefined
          ? { "margin-block-end": `calc(-1 * ${t.spacing2})` }
          : {}),
      };
      // The reveal, and the reason a disclosure is not a `<div>`.
      //
      // The platform gives the content its own box — `::details-content` —
      // and toggles it in place, so a disclosure can be animated with no
      // JavaScript and no wrapper: the size moves between clamped and
      // natural while the summary above it stays exactly where it was. The
      // summary is not inside the content box, which is what keeps the label
      // from moving with the body.
      //
      // The transition is stated as a shorthand because the two properties
      // move in different ways: the size interpolates, and the visibility is
      // discrete — it changes at a moment rather than over the duration, and
      // `allow-discrete` is what lets it change at all. Stating the behaviour
      // for the size too would flip the content into view halfway through
      // instead of growing it, which is the jump this exists to remove.
      //
      // An engine that knows none of this ships the element it already had:
      // the selectors match nothing, the closed content is hidden and the
      // open content is shown, in one frame, exactly as before.
      const reveal = t.reveal !== undefined
        ? `block-size ${t.reveal}${
          t.easeOut !== undefined ? ` ${t.easeOut}` : ""
        }, content-visibility ${t.reveal} allow-discrete`
        : undefined;
      yield {
        [ctx.symbols.selector]: () => `${details}::details-content`,
        "block-size": "0",
        // The clip is the other half of the clamp: without it the content
        // spills over the page below while the box shrinks.
        overflow: "hidden",
        ...(reveal !== undefined ? { transition: reveal } : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${details}[open]::details-content`,
        "block-size": "auto",
      };
    },
    { layer: "primitives", autocomplete: "details" },
  ];
}

/**
 * The label: a wrapping row, a pointer, and the indicator.
 *
 * The marker cannot be styled, so it is hidden and drawn again as a chevron —
 * a square with two borders on one corner, rotated to point down. The same
 * trick the checkbox uses for its tick, and for the same reason: the shape is
 * geometry rather than a glyph, so it needs no font and scales with the type.
 *
 * Hovering raises the whole label, not just the marker, because the label is
 * the control and the marker is a picture of it.
 */
function summaryRule(summary: string, details: string): Rule {
  return [
    /^summary$/,
    function* (_m, ctx) {
      const t = tokens(ctx);

      yield {
        [ctx.symbols.selector]: () => summary,
        display: "flex",
        // The label's row WRAPS, the way the card's footer and the dialog's
        // actions row do: a row that cannot wrap pushes the indicator out of
        // the label it belongs to. The layout contract pins this.
        "flex-wrap": "wrap",
        "align-items": "center",
        ...(t.spacing2 !== undefined ? { gap: t.spacing2 } : {}),
        // The label owns the row's padding — the container carries none — so
        // the hover fill reaches the card edge instead of floating as an
        // inset pill inside the card's own padding.
        ...(t.spacing2 !== undefined ? { padding: t.spacing2 } : {}),
        ...(t.radius !== undefined ? { "border-radius": t.radius } : {}),
        cursor: "pointer",
        // Firefox. The webkit marker is a pseudo-element and needs its own
        // declaration below; there is no spelling that reaches both at once,
        // and leaving either in place is how a disclosure ends up with two
        // indicators in three browsers.
        "list-style": "none",
        // The label wears the body-strong voice's weight — emphasis for the
        // row that opens — with the ladder step that style is built from as
        // the window fallback.
        ...(() => {
          const weight = t.weightSemibold.weight ??
            ladder(ctx, "font.weight.semibold");
          return weight !== undefined ? { "font-weight": weight } : {};
        })(),
        ...(t.text !== undefined ? { color: t.text } : {}),
        ...(t.duration !== undefined
          ? { "transition-duration": t.duration }
          : {}),
        ...(t.easing !== undefined
          ? { "transition-timing-function": t.easing }
          : {}),
        ...(t.duration !== undefined
          ? { "transition-property": "background-color, color" }
          : {}),
      };

      // The row is the control, so pointing at it says so before the press.
      // The fill is the sunken surface — the page's own step below the card —
      // and the label owns the row's padding, so the fill reaches the card
      // edge instead of floating as an inset pill.
      yield {
        [ctx.symbols.selector]: () => `${summary}:hover`,
        ...(t.sunken !== undefined ? { "background-color": t.sunken } : {}),
      };
      // Open: the body hangs below the label, so the label keeps only its
      // top corners — bottom rounding mid-card would read as a second edge.
      yield {
        [ctx.symbols.selector]: () => `${details}[open] > ${summary}`,
        "border-end-end-radius": "0",
        "border-end-start-radius": "0",
      };

      yield {
        [ctx.symbols.selector]: () => `${summary}::-webkit-details-marker`,
        display: "none",
      };

      // The focus ring belongs to the row: the row is the control, so the
      // control is what shows focus. It is the theme's own ring — the
      // browser's default is not the theme's, and a default ring is a colour
      // nobody chose. The summary wears no border of its own, so the outline
      // is the whole of its edge.
      yield {
        [ctx.symbols.selector]: () => `${summary}:focus-visible`,
        ...(t.focusWidth !== undefined && t.focusRing !== undefined
          ? { outline: `${t.focusWidth} solid ${t.focusRing}` }
          : {}),
        ...(t.focusOffset !== undefined
          ? { "outline-offset": t.focusOffset }
          : {}),
      };

      // The indicator is a chevron drawn from a square's corner — the same
      // construction as the checkbox tick, because it has the same property:
      // the shape is geometry rather than a glyph, so it needs no font and
      // scales with the type.
      //
      // Which angle points which way was measured rather than reasoned about.
      // A square showing its right and bottom borders has one corner at the
      // lower right: 45° points it straight DOWN, and a quarter further
      // (-45°) points it RIGHT. A collapsed disclosure points at its label's
      // continuation — right — and an open one points down at the content it
      // has revealed, which is the direction every disclosure in every
      // library reads.
      const chevron: Record<string, string | undefined> = {
        content: '""',
        display: "block",
        flex: "none",
        // The indicator is the row's trailing edge, not a glyph that follows
        // the label: at the end it reads as the control's state, and it stays
        // there whether the label is one word or twenty.
        "margin-inline-start": "auto",
        width: "0.375em",
        height: "0.375em",
        "border-inline-end": "1.5px solid",
        "border-block-end": "1.5px solid",
        ...(t.muted !== undefined ? { "border-color": t.muted } : {}),
        rotate: "-45deg",
      };
      if (t.duration !== undefined) {
        Object.assign(chevron, {
          "transition-property": "rotate, border-color",
          "transition-duration": t.duration,
          "transition-timing-function": t.easing ?? "linear",
        });
      }

      yield {
        [ctx.symbols.selector]: () => `${summary}::after`,
        ...chevron,
      };
      yield {
        [ctx.symbols.selector]: () => `${summary}:hover::after`,
        ...(t.text !== undefined ? { "border-color": t.text } : {}),
      };
      // Open: a quarter further on. The turn is the state — the reader sees
      // the indicator move rather than reading its angle, which is what works
      // at any size and in forced-colours mode where the border colour may be
      // overridden entirely.
      yield {
        [ctx.symbols.selector]: () => `${details}[open] > ${summary}::after`,
        rotate: "45deg",
      };
    },
    { layer: "primitives", autocomplete: "summary" },
  ];
}
