import type { Rule } from "@unocss/core";
import { token } from "../../utils/lookup.ts";
import { styleType } from "./shared.ts";


/**
 * Meter — the native `<meter>` gauge.
 *
 * A meter is a measurement inside a known range, and the platform already
 * knows where the value sits: `low`/`high` split the range into bands and
 * `optimum` says which band is the good one, so the engine decides which of
 * three fills the value gets. This rule lends those fills the theme's
 * semantic colours and leaves the classification — the part that would be
 * arithmetic in JavaScript — exactly where it is: in the browser.
 *
 * The engine gap is the one `progress` has: Chromium paints
 * `::-webkit-meter-*` and ignores `::-moz-*`, Gecko paints the reverse, so
 * both spellings of the fill are stated. Gecko qualifies its single bar
 * pseudo with `:-moz-meter-*` on the element, so each band gets its own
 * selector chain rather than its own pseudo.
 */
export function meterRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("meter")) return [];
  return [meterRule()];
}

function meterRule(): Rule {
  const meter = "meter";
  return [
    /^meter$/,
    function* (_m, ctx) {
      // The element itself: the type the gauge's fallback text is read in,
      // plus Gecko's trough. Firefox draws the groove on the element box,
      // not a pseudo, so the element carries the trough paint and drops
      // native appearance — without it the trough renders the platform's
      // white on every dark theme. WebKit keeps its native element and
      // paints the trough on its bar pseudo below.
      yield {
        [ctx.symbols.selector]: () => meter,
        display: "block",
        width: "100%",
        "-moz-appearance": "none",
        // Gecko's UA sheet paints a light gradient on the element box and
        // `appearance: none` does not lift it: the trough's theme colour
        // needs the gradient explicitly gone.
        "background-image": "none",
        ...(token(ctx, "spacing.2") !== undefined
          ? { height: token(ctx, "spacing.2") }
          : {}),
        // The gauge's fallback text reads in the label voice — the
        // small-medium advisory type.
        ...(() => {
          const label = styleType(ctx, "label");
          const family = label.family;
          const size = label.size;
          return {
            ...(family !== undefined ? { "font-family": family } : {}),
            ...(size !== undefined ? { "font-size": size } : {}),
          };
        })(),
        ...(token(ctx, "color.field") !== undefined
          ? { "background-color": token(ctx, "color.field") }
          : {}),
        ...(token(ctx, "border.width") !== undefined &&
            token(ctx, "color.border") !== undefined
          ? {
            border: `${token(ctx, "border.width")} solid ${
              token(ctx, "color.border")
            }`,
          }
          : {}),
        ...(token(ctx, "radius.sm") !== undefined
          ? { "border-radius": token(ctx, "radius.sm") }
          : {}),
      };

      // The trough. `field` is the theme's word for a control's own inset
      // interior — the slot a value is read out of — which is what a gauge's
      // groove is; `surface` is the page the control sits on, and a trough
      // painted the page's colour reads as a hole, not a channel.
      yield {
        [ctx.symbols.selector]: () => `${meter}::-webkit-meter-bar`,
        ...(token(ctx, "color.field") !== undefined
          ? { "background-color": token(ctx, "color.field") }
          : {}),
        ...(token(ctx, "border.width") !== undefined &&
            token(ctx, "color.border") !== undefined
          ? {
            border: `${token(ctx, "border.width")} solid ${
              token(ctx, "color.border")
            }`,
          }
          : {}),
        ...(token(ctx, "radius.sm") !== undefined
          ? { "border-radius": token(ctx, "radius.sm") }
          : {}),
      };

      // The three bands, one pseudo each: the platform paints exactly the
      // one the value is in, so the colour is the only opinion here. The
      // vendor appearance property is stated because that is where each
      // engine looks for it on the pseudo, and stating it also keeps these
      // bodies distinct enough that uno never merges a webkit pseudo into a
      // list with a moz one — a merged list is dropped whole by any engine
      // that does not know one selector in it.
      yield {
        [ctx.symbols.selector]: () => `${meter}::-webkit-meter-optimum-value`,
        ...(token(ctx, "color.semantic.success") !== undefined
          ? { "background-color": token(ctx, "color.semantic.success") }
          : {}),
        "-webkit-appearance": "none",
      };
      yield {
        [ctx.symbols.selector]: () =>
          `${meter}::-webkit-meter-suboptimum-value`,
        ...(token(ctx, "color.semantic.warning") !== undefined
          ? { "background-color": token(ctx, "color.semantic.warning") }
          : {}),
        "-webkit-appearance": "none",
      };
      yield {
        [ctx.symbols.selector]: () =>
          `${meter}::-webkit-meter-even-less-good-value`,
        ...(token(ctx, "color.semantic.error") !== undefined
          ? { "background-color": token(ctx, "color.semantic.error") }
          : {}),
        "-webkit-appearance": "none",
      };

      // Gecko's one bar pseudo, qualified by the band the value is in.
      // Firefox exposes `:-moz-meter-optimum` and friends on the ELEMENT,
      // so the bar takes the band's colour and the optimum band is the
      // default a bare gauge reads in.
      yield {
        [ctx.symbols.selector]: () => `${meter}::-moz-meter-bar`,
        ...(token(ctx, "color.semantic.success") !== undefined
          ? { "background-color": token(ctx, "color.semantic.success") }
          : {}),
        ...(token(ctx, "radius.sm") !== undefined
          ? { "border-radius": token(ctx, "radius.sm") }
          : {}),
        "-moz-appearance": "none",
      };
      yield {
        [ctx.symbols.selector]: () =>
          `${meter}:-moz-meter-sub-optimum::-moz-meter-bar`,
        ...(token(ctx, "color.semantic.warning") !== undefined
          ? { "background-color": token(ctx, "color.semantic.warning") }
          : {}),
        ...(token(ctx, "radius.sm") !== undefined
          ? { "border-radius": token(ctx, "radius.sm") }
          : {}),
        "-moz-appearance": "none",
      };
      yield {
        [ctx.symbols.selector]: () =>
          `${meter}:-moz-meter-sub-sub-optimum::-moz-meter-bar`,
        ...(token(ctx, "color.semantic.error") !== undefined
          ? { "background-color": token(ctx, "color.semantic.error") }
          : {}),
        ...(token(ctx, "radius.sm") !== undefined
          ? { "border-radius": token(ctx, "radius.sm") }
          : {}),
        "-moz-appearance": "none",
      };

      // A disabled gauge is dead input, not a different measurement: it
      // dims by the theme's opacity scale when the theme carries one, and
      // by the platform-neutral 0.55 when it does not — a state literal,
      // not a design value.
      yield {
        [ctx.symbols.selector]: () => `${meter}:disabled`,
        opacity: token(ctx, "opacity.50") ?? 0.55,
      };
    },
    { layer: "primitives", autocomplete: "meter" },
  ];
}
