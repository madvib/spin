import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import type { Mode } from "./shared.ts";

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
 * is one spacing step thick and the thumb is the step above it, so the thumb
 * overhangs the track by half the difference on each side. The margin states
 * exactly that half as a calc of the two tokens read from the theme, so a
 * size change carries the centring with it. Firefox centres its own thumb
 * and would be moved by the margin, so it takes none.
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
      const t = themeOf(ctx);
      const trackHeight = t?.spacing?.["2"];
      const thumbSize = t?.spacing?.["4"];
      const field = t?.colors?.["field"];
      const border = t?.colors?.["border"];
      const borderWidth = t?.borderWidth?.["width"];
      const primary = t?.colors?.["primary"];
      const shadowSm = t?.shadow?.["sm"];
      const full = t?.radius?.["full"];
      const focusWidth = t?.focusWidth?.["width"];
      const focusRing = t?.colors?.["focus-ring"];
      const offset = t?.spacing?.["1"];

      // The element itself: a host for the pseudo-elements, sized by the
      // track's own step. `spacing.2` rather than a heavier step because the
      // scale carries no `3` and a slider is a band you grab, not a groove.
      // `background: transparent` because the surface belongs to the track —
      // a tinted host behind it reads as a second, larger track.
      //
      // The padding and border-width are taken back from the field box: it
      // pads every text-like input, and half-rem padding inside a half-rem
      // border-box leaves no content box for the track to sit in. The border
      // goes by `border-width`, never by the `border` shorthand — the
      // preflight documents that Chromium keys a control's `appearance` to
      // whether it has a border at all, and `border: 0 solid` sets the style
      // to `none`, which silently restores the platform's own slider.
      yield {
        [ctx.symbols.selector]: () => 'input[type="range"]',
        appearance: "none",
        "-webkit-appearance": "none",
        "-moz-appearance": "none",
        ...(trackHeight !== undefined ? { height: trackHeight } : {}),
        background: "transparent",
        cursor: "pointer",
        padding: "0",
        "border-width": "0",
      };

      // The groove: the field surface — the colour a text field's box spends
      // — fully round, one step thick, with the border token as an edge.
      //
      // The edge is not decoration: in a starter whose `field` sits at the
      // page's own depth (console) a bare fill is invisible against the
      // page, and a slider whose groove you cannot see is a thumb floating
      // on nothing. The border is drawn on the pseudo, never on the host —
      // the preflight documents that Chromium keys a control's appearance
      // to whether the HOST has a border, and styling the host silently
      // restores the platform slider.
      const track = {
        ...(field !== undefined ? { "background-color": field } : {}),
        ...(borderWidth !== undefined && border !== undefined
          ? { border: `${borderWidth} solid ${border}` }
          : {}),
        ...(full !== undefined ? { "border-radius": full } : {}),
        ...(trackHeight !== undefined ? { height: trackHeight } : {}),
      };
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="range"]::-webkit-slider-runnable-track',
        ...track,
        "-webkit-appearance": "none",
      };
      yield {
        [ctx.symbols.selector]: () => 'input[type="range"]::-moz-range-track',
        ...track,
        "-moz-appearance": "none",
      };

      // The thumb: the primary tone, one step above the track, fully round,
      // wearing the theme's own physical language — a soft lift, a hard
      // offset edge or a phosphor ring — so the value's handle reads as an
      // object the theme made rather than a decal on the page.
      const thumb = {
        appearance: "none",
        ...(thumbSize !== undefined
          ? { width: thumbSize, height: thumbSize }
          : {}),
        ...(primary !== undefined ? { "background-color": primary } : {}),
        ...(shadowSm !== undefined ? { "box-shadow": shadowSm } : {}),
        ...(full !== undefined ? { "border-radius": full } : {}),
      };
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="range"]::-webkit-slider-thumb',
        ...thumb,
        // Half the difference between the two steps, negative: webkit positions
        // its thumb against the track box, and without this the thumb sits a
        // quarter-rem low. Firefox takes no margin — it centres its own thumb.
        ...(trackHeight !== undefined && thumbSize !== undefined
          ? { "margin-top": `calc((${trackHeight} - ${thumbSize}) / 2)` }
          : {}),
        "-webkit-appearance": "none",
      };
      yield {
        [ctx.symbols.selector]: () => 'input[type="range"]::-moz-range-thumb',
        ...thumb,
        "-moz-appearance": "none",
      };

      // Focus: the ring every interactive element shares, as an outline so it
      // never resizes the control, lifted clear of the thumb that overhangs
      // the track.
      yield {
        [ctx.symbols.selector]: () => 'input[type="range"]:focus-visible',
        ...(focusWidth !== undefined && focusRing !== undefined
          ? { outline: `${focusWidth} solid ${focusRing}` }
          : {}),
        ...(offset !== undefined ? { "outline-offset": offset } : {}),
      };

      // Disabled: dimmed, not gone. The theme's opacity scale owns the
      // fraction; the literal is only for a theme carrying no such ref —
      // which is every theme today, the scale powers the utilities.
      yield {
        [ctx.symbols.selector]: () => 'input[type="range"]:disabled',
        opacity: t?.opacity?.["50"] ?? 0.55,
      };
    },
    { layer: "primitives", autocomplete: "range" },
  ];
}
