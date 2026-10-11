import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

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
 * both spellings of the fill are stated. Gecko has one bar pseudo where
 * Chromium has three, so its single bar takes the success fill.
 *
 * All of it yields from the one `/^meter$/` rule: uno keeps only the first
 * rule matching a token, so separate rules per pseudo-element would leave
 * every pseudo but the first unstyled.
 */
export function meterRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("meter")) return [];
  return [meterRule(mode)];
}

function meterRule(mode: Mode): Rule {
  const meter = claim(mode, "meter");
  return [
    /^meter$/,
    function* (_m, ctx) {
      const t = themeOf(ctx);

      // The element itself: the platform draws the frame, so this spends
      // nothing but the type the gauge's fallback text is read in.
      yield {
        [ctx.symbols.selector]: () => meter,
        ...(t?.fontFamily?.["sans"] !== undefined
          ? { "font-family": t.fontFamily["sans"] }
          : {}),
        ...(t?.fontSize?.["sm"] !== undefined
          ? { "font-size": t.fontSize["sm"] }
          : {}),
      };

      // The trough. `field` is the theme's word for a control's own inset
      // interior — the slot a value is read out of — which is what a gauge's
      // groove is; `surface` is the page the control sits on, and a trough
      // painted the page's colour reads as a hole, not a channel.
      yield {
        [ctx.symbols.selector]: () => `${meter}::-webkit-meter-bar`,
        ...(t?.colors?.["field"] !== undefined
          ? { "background-color": t.colors["field"] }
          : {}),
        ...(t?.borderWidth?.["width"] !== undefined &&
            t?.colors?.["border"] !== undefined
          ? {
            border: `${t.borderWidth["width"]} solid ${t.colors["border"]}`,
          }
          : {}),
        ...(t?.radius?.["sm"] !== undefined
          ? { "border-radius": t.radius["sm"] }
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
        ...(t?.colors?.["semantic-success"] !== undefined
          ? { "background-color": t.colors["semantic-success"] }
          : {}),
        "-webkit-appearance": "none",
      };
      yield {
        [ctx.symbols.selector]: () =>
          `${meter}::-webkit-meter-suboptimum-value`,
        ...(t?.colors?.["semantic-warning"] !== undefined
          ? { "background-color": t.colors["semantic-warning"] }
          : {}),
        "-webkit-appearance": "none",
      };
      yield {
        [ctx.symbols.selector]: () =>
          `${meter}::-webkit-meter-even-less-good-value`,
        ...(t?.colors?.["semantic-error"] !== undefined
          ? { "background-color": t.colors["semantic-error"] }
          : {}),
        "-webkit-appearance": "none",
      };

      // Gecko's one bar pseudo carries the success fill, its only band.
      yield {
        [ctx.symbols.selector]: () => `${meter}::-moz-meter-bar`,
        ...(t?.colors?.["semantic-success"] !== undefined
          ? { "background-color": t.colors["semantic-success"] }
          : {}),
        "-moz-appearance": "none",
      };

      // A disabled gauge is dead input, not a different measurement: it
      // dims by the theme's opacity scale when the theme carries one, and
      // by the platform-neutral 0.55 when it does not — a state literal,
      // not a design value.
      yield {
        [ctx.symbols.selector]: () => `${meter}:disabled`,
        opacity: t?.opacity?.["50"] ?? 0.55,
      };
    },
    { layer: "primitives", autocomplete: "meter" },
  ];
}
