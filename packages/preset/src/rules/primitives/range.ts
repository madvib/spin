import type { Rule } from "@unocss/core";
import { token } from "../../utils/lookup.ts";
import { focusRing, type Mode, withFallback } from "./shared.ts";

/**
 * Range — `<input type="range">`, the slider.
 *
 * The token is the TYPE, not the tag: the type extractor turns
 * `type="range"` into `range`, and the bare `input` token belongs to the
 * field box, which deliberately does not exclude range from itself — a
 * range states its own geometry, and this selector is the more specific one.
 * So the selector is the attribute a consumer already writes, in classless
 * and classed modes alike — `_mode` is part of the shape every rule shares,
 * but the attribute is in the consumer's markup either way.
 *
 * There is no cross-browser rendering to theme. Chromium paints a track and
 * a thumb through `::-webkit-slider-runnable-track` and
 * `::-webkit-slider-thumb`; Firefox through `::-moz-range-track` and
 * `::-moz-range-thumb`. Neither engine reads the other's, so both are
 * stated — and, as the progress rule learned the hard way, each engine's
 * rule must carry a declaration the other's does not (`-webkit-appearance`
 * against `-moz-appearance`): uno merges identical bodies into one selector
 * list, and an unrecognised pseudo-element in a list voids the entire rule
 * in every other browser. The vendor property each engine actually reads
 * is the difference that keeps the bodies apart.
 *
 * `appearance: none` is the price of admission: while the platform paints
 * the slider, none of the four pseudo-elements can be styled at all.
 *
 * The webkit thumb centres with a negative margin, not with luck: the track
 * is one step thick and the thumb is the step above it, so the thumb
 * overhangs the track by half the difference on each side. The margin states
 * exactly that half as a calc of the two tokens read from the theme, so a
 * size change carries the centring with it. Firefox centres its own thumb
 * and would be moved by the margin, so it takes none.
 *
 * **The slider is three things, and each is a decision.** A GROOVE the value
 * travels in, a FILL that says how far along it is, and a THUMB the reader
 * holds. Each is drawn from the theme, and none of them is a decoration:
 *
 * - **The groove reads in both modes.** Its interior is the field — the
 *   colour a control's own slot spends — and its edge is the strong border,
 *   not the hairline. `color.border` is a divider's ink: at one pixel it is
 *   close to invisible on a light field, and in a dark theme where the
 *   field and the border are the same colour it is not visible at all, so a
 *   slider whose groove you cannot see is a thumb floating on nothing. The
 *   strong border is the role the system keeps for a control's edge.
 * - **The fill says how far along the value is.** It is the primary, thinned
 *   so the THUMB — the primary itself — still reads as a shape against it.
 *   A fill in the thumb's own colour swallows the half of the thumb that
 *   sits on it, and a knob that is half a knob is the same duotone the
 *   owner complained about, one step further along.
 * - **The thumb is one solid colour.** No shadow, no ring, no second tone:
 *   the thumb is the theme's acting colour, flat, and the only thing that
 *   gives it depth is the groove it sits in.
 *
 * **How far along the value is, is a runtime fact.** The browser knows it
 * and CSS cannot read it, so the primitive asks for it: the element carries
 * `--range-progress`, a percentage of the travel, and the fill is drawn up
 * to it. A consumer that does not set it gets a groove with no fill — the
 * primitive never guesses a value it cannot know.
 */
export function rangeRules(roots: readonly string[], _mode: Mode): Rule[] {
  if (!roots.includes("range")) return [];
  return [rangeRule()];
}

/** The slider: its host, both engines' tracks and thumbs, and its states. */
function rangeRule(): Rule {
  return [
    /^range$/,
    function* (_m, ctx) {
      // The groove is one step thick and the thumb the step above it, so the
      // thumb overhangs the groove by half the difference on each side — the
      // difference the thumb's margin states.
      const groove = token(ctx, "spacing.3");
      const thumbSize = token(ctx, "spacing.4");
      const field = token(ctx, "color.field");
      // The groove's edge: the strong border, falling back to the hairline
      // for a theme that states no stronger one.
      const edge = withFallback(ctx, "color.border-strong", "color.border");
      const borderWidth = token(ctx, "border.width");
      const primary = token(ctx, "color.primary");
      const full = token(ctx, "radius.full");
      const ring = focusRing(ctx);

      // The element itself: a host for the pseudo-elements, and the ring's
      // subject.
      //
      // The host is the groove's own thickness, so the focus ring stands
      // off the groove's EDGE — the theme's offset from the border, the
      // distance the field box's ring stands from the field's edge. A host
      // taller than the groove would put the ring clear of the groove and
      // leave it standing off nothing, and the ring and the edge would read
      // as two borders arguing rather than as one focus treatment.
      //
      // The thumb is the step above the groove, so it overhangs by half the
      // difference — and the ring, at the theme's offset, lands exactly on
      // the thumb's edge: close enough to be one treatment, far enough that
      // the thumb never covers it.
      //
      // `background: transparent` because the surface belongs to the groove —
      // a tinted host behind it reads as a second, larger groove.
      //
      // The padding and border-width are taken back from the field box: it
      // pads every text-like input, and half-rem padding inside a half-rem
      // border-box leaves no content box for the groove to sit in. The
      // border goes by `border-width`, never by the `border` shorthand — the
      // preflight documents that Chromium keys a control's `appearance` to
      // whether it has a border at all, and `border: 0 solid` sets the style
      // to `none`, which silently restores the platform's own slider.
      yield {
        [ctx.symbols.selector]: () => 'input[type="range"]',
        appearance: "none",
        "-webkit-appearance": "none",
        "-moz-appearance": "none",
        // The field box's height floor belongs to text fields; a slider is a
        // groove of its own height.
        "min-height": "0",
        ...(groove !== undefined ? { height: groove } : {}),
        background: "transparent",
        cursor: "pointer",
        padding: "0",
        "border-width": "0",
        // The ring is the slider's shape: a pill, like the groove it rings.
        ...(full !== undefined ? { "border-radius": full } : {}),
        // The fill's two facts, on the element. A custom property set on the
        // element is inherited by its pseudo-elements and substituted first,
        // so the gradient on the groove resolves them; a value written
        // straight into the gradient does not.
        ...(primary !== undefined
          ? {
            "--range-fill": `color-mix(in oklab, ${primary} 35%, transparent)`,
          }
          : {}),
        "--range-progress": "0%",
      };

      // The groove: the field's own interior, fully round, one step thick,
      // with the strong border as its edge — and the fill, up to how far
      // along the value is.
      //
      // The fill is drawn over the groove's own colour, and it stops at the
      // THUMB's centre rather than at the thumb's edge: the thumb travels
      // between the two ends of the groove minus itself, so the fill's area
      // is the travel and the fill's end is where the thumb is. The
      // background's size and position are what say so — the fill is drawn
      // over the TRAVEL, inset by half the thumb at each end, which is
      // where the thumb's centre is at the two extremes.
      const track = {
        ...(field !== undefined ? { "background-color": field } : {}),
        ...(borderWidth !== undefined && edge !== undefined
          ? { border: `${borderWidth} solid ${edge}` }
          : {}),
        ...(full !== undefined ? { "border-radius": full } : {}),
        ...(groove !== undefined ? { height: groove } : {}),
      };
      const fill = primary !== undefined && thumbSize !== undefined
        ? {
          "background-image":
            "linear-gradient(to right, var(--range-fill) 0 var(--range-progress), transparent var(--range-progress))",
          "background-size": `calc(100% - ${thumbSize}) 100%`,
          "background-position": `calc(${thumbSize} / 2) 0`,
          "background-repeat": "no-repeat",
        }
        : {};
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="range"]::-webkit-slider-runnable-track',
        ...track,
        ...fill,
        "-webkit-appearance": "none",
      };
      yield {
        [ctx.symbols.selector]: () => 'input[type="range"]::-moz-range-track',
        ...track,
        ...fill,
        "-moz-appearance": "none",
      };

      // Focus: the ring every interactive element shares, as an outline so
      // it never resizes the control.
      yield {
        [ctx.symbols.selector]: () => 'input[type="range"]:focus-visible',
        ...(ring.width !== undefined && ring.color !== undefined
          ? { outline: `${ring.width} solid ${ring.color}` }
          : {}),
        ...(ring.offset !== undefined ? { "outline-offset": ring.offset } : {}),
      };
      // A pointer that lands on a slider leaves no ring: the browser's own
      // is not the theme's, so it goes.
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="range"]:focus:not(:focus-visible)',
        outline: "none",
      };
      // The same ring for engines without :focus-visible. A rule cannot be
      // wrapped in `@supports` from its body, so the parent symbol carries
      // the at-rule and the selector symbol the fallback selector.
      yield {
        [ctx.symbols.parent]: "@supports not selector(:focus-visible)",
        [ctx.symbols.selector]: () => 'input[type="range"]:focus',
        ...(ring.width !== undefined && ring.color !== undefined
          ? { outline: `${ring.width} solid ${ring.color}` }
          : {}),
        ...(ring.offset !== undefined ? { "outline-offset": ring.offset } : {}),
      };
      // And the ring is the control's edge: the groove's own border takes
      // the ring's ink while the slider is focused, so the reader sees one
      // edge in the theme's focus colour rather than the groove's edge with a
      // second band beside it.
      if (ring.color !== undefined) {
        yield {
          [ctx.symbols.selector]: () =>
            'input[type="range"]:focus-visible::-webkit-slider-runnable-track',
          "border-color": ring.color,
        };
        yield {
          [ctx.symbols.selector]: () =>
            'input[type="range"]:focus-visible::-moz-range-track',
          "border-color": ring.color,
        };
      }

      // The thumb: the primary, one step above the groove, fully round, and
      // FLAT. A shadow would give the knob a second tone — the one thing a
      // handle on a groove must not have, because the handle is what the
      // reader aims at.
      const thumb = {
        appearance: "none",
        ...(thumbSize !== undefined
          ? { width: thumbSize, height: thumbSize }
          : {}),
        ...(primary !== undefined ? { "background-color": primary } : {}),
        ...(full !== undefined ? { "border-radius": full } : {}),
      };
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="range"]::-webkit-slider-thumb',
        ...thumb,
        // Half the difference between the two steps, negative: webkit positions
        // its thumb against the track box, and without this the thumb sits a
        // quarter-rem low. Firefox takes no margin — it centres its own thumb.
        ...(groove !== undefined && thumbSize !== undefined
          ? { "margin-top": `calc((${groove} - ${thumbSize}) / 2)` }
          : {}),
        "-webkit-appearance": "none",
      };
      yield {
        [ctx.symbols.selector]: () => 'input[type="range"]::-moz-range-thumb',
        ...thumb,
        "-moz-appearance": "none",
      };

      // Disabled: dimmed, not gone. The theme's opacity scale owns the
      // fraction; the literal is only for a theme carrying no such ref —
      // which is every theme today, the scale powers the utilities.
      yield {
        [ctx.symbols.selector]: () => 'input[type="range"]:disabled',
        opacity: token(ctx, "opacity.50") ?? 0.55,
      };
    },
    { layer: "primitives", autocomplete: "range" },
  ];
}
