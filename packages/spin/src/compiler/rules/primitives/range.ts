import type { SpinRule } from "../../utils/lookup.ts";

import { ALIVE, disabledPosture, focusPaint, focusRing } from "./shared.ts";

/**
 * Range — a drawn control, not a themed `accent-color`.
 *
 * It was unpainted, which meant the browser's own range in every theme: a
 * blue fill the system had no say over. Like the checkbox and the radio, it
 * draws itself — `appearance: none`, then a groove, a fill and a thumb.
 *
 * The fill is a `linear-gradient` sized by the `--range-progress` share the
 * control hands the sheet inline (a percent, defaulting to empty when the
 * control names no share). The sheet cannot read the value, so the share
 * travels as a custom property and the gradient stops follow it — the fill
 * ends where the thumb is, in every theme, without the rule knowing the
 * value.
 *
 * Both vendor pseudo-element families are painted: webkit draws the groove
 * on the input itself with the thumb as `::-webkit-slider-thumb`, while
 * moz draws the groove as `::-moz-range-track` with
 * `::-moz-range-progress` carrying the fill. The tokens are the same on
 * both paths, so the two engines agree.
 */
export function rangeRules(roots: readonly string[]): SpinRule[] {
  if (!roots.includes("range")) return [];
  return [
    [
      /^range$/,
      function* (_m, ctx) {
        const sunken = ctx?.theme?.color?.["surface-sunken"];
        const primary = ctx?.theme?.color?.primary;
        const surface = ctx?.theme?.color?.surface;
        const border = ctx?.theme?.color?.border;
        const borderWidth = ctx?.theme?.border?.width;
        const radius = ctx?.theme?.radius?.full;
        const grooveHeight = ctx?.theme?.spacing?.[1] ?? "0.375rem";
        const thumbSize = ctx?.theme?.spacing?.[4] ?? "1rem";
        const ring = focusRing(ctx);

        // The fill ends where the thumb is: the share the control hands
        // over, a percent defaulting to empty rather than to a full
        // primary bar. The fill is an image over the groove's own color —
        // two longhands, so no shorthand fight and each side stays readable
        // on its own.
        const track = primary !== undefined
          ? `linear-gradient(to right, ${primary} 0, ${primary} var(--range-progress, 0%), transparent var(--range-progress, 0%), transparent 100%)`
          : undefined;
        // The field box also claims `input`: its `min-height`, `padding`,
        // and `border` would make the groove a 34px pill. Reset all three —
        // the groove is a drawn track, not a text field.
        const groove: Record<string, string | undefined> = {
          appearance: "none",
          "-webkit-appearance": "none",
          "-moz-appearance": "none",
          background: "transparent",
          cursor: "pointer",
          "min-height": "0",
          height: grooveHeight,
          padding: "0",
          border: "none",
          "border-radius": radius ?? "9999px",
          ...(sunken !== undefined ? { "background-color": sunken } : {}),
          ...(track !== undefined ? { "background-image": track } : {}),
        };
        yield {
          [ctx.symbols.selector]: () => 'input[type="range"]',
          ...groove,
        };

        const thumb: Record<string, string | undefined> = {
          appearance: "none",
          width: thumbSize,
          height: thumbSize,
          "border-radius": "50%",
          ...(surface !== undefined ? { "background-color": surface } : {}),
          ...(borderWidth !== undefined && border !== undefined
            ? { border: `${borderWidth} solid ${border}` }
            : {}),
          // The thumb carries the tone in its edge while at rest, and takes
          // it through when pressed: a ring with a dot reads as a handle,
          // a solid disc reads as a blob.
          ...(primary !== undefined
            ? { "border-color": primary }
            : {}),
          cursor: "pointer",
        };
        yield {
          [ctx.symbols.selector]: () => 'input[type="range"]::-webkit-slider-thumb',
          "-webkit-appearance": "none",
          ...thumb,
        };
        yield {
          [ctx.symbols.selector]: () => 'input[type="range"]::-moz-range-thumb',
          "-moz-appearance": "none",
          ...thumb,
        };

        // Mozilla paints the groove as a track with its own progress fill;
        // the same tokens, so the two engines agree.
        yield {
          [ctx.symbols.selector]: () => 'input[type="range"]::-moz-range-track',
          height: grooveHeight,
          "border-radius": radius ?? "9999px",
          ...(sunken !== undefined ? { "background-color": sunken } : {}),
        };
        yield {
          [ctx.symbols.selector]: () =>
            'input[type="range"]::-moz-range-progress',
          height: grooveHeight,
          "border-radius": radius ?? "9999px",
          ...(primary !== undefined ? { "background-color": primary } : {}),
        };

        // The ring, drawn on focus-visible so a mouse press leaves none.
        yield {
          [ctx.symbols.selector]: () => 'input[type="range"]:focus-visible',
          ...focusPaint(ring),
        };
        // A dead track wears the disabled posture on groove and thumb both:
        // a live thumb on a dead groove says otherwise.
        yield {
          [ctx.symbols.selector]: () =>
            `input[type="range"]:is(:disabled, [aria-disabled="true"])`,
          cursor: "not-allowed",
          ...disabledPosture(ctx),
        };
        yield {
          [ctx.symbols.selector]: () =>
            `input[type="range"]${ALIVE}::-webkit-slider-thumb:active`,
          "-webkit-appearance": "none",
          ...(primary !== undefined
            ? { "background-color": primary }
            : {}),
        };
      },
    ],
  ];
}
