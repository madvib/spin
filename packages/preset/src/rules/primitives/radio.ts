import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";

/**
 * Radio — a drawn control, not a themed `accent-color`.
 *
 * It was an alias with no declarations, which meant the browser's own radio in
 * every theme: a small grey dot the system had no say over. Like the checkbox
 * and the switch, it draws itself — `appearance: none`, then a border, a
 * surface and a dot.
 *
 * The dot is a pseudo-element rather than a background, because a background
 * would have to be sized in proportion to the control and a dot that grows with
 * the box is not a dot. It is centred with `inset: 0` plus `margin: auto`,
 * which needs no arithmetic at all.
 *
 * A radio is a circle, so its radius is half its size — stated as a fraction
 * rather than a length so a size change carries the curve with it. This is the
 * one place a control's radius is derived from its box instead of read from
 * `radius.md`, because a 4px radius on a 20px circle is a squircle, and a
 * squircle is not a radio.
 */
export function radioRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("radio")) return [];
  return [
    [
      /^radio$/,
      function* (_m, ctx) {
        const t = themeOf(ctx);
        const size = t?.spacing["4"];
        const borderWidth = t?.borderWidth?.["width"];
        const border = t?.colors?.["border"];
        const field = t?.colors?.["field"];
        const primary = t?.colors?.["primary"];
        const duration = t?.motionDuration?.["fast"];
        const easing = t?.motionEasing?.["standard"];
        const focusWidth = t?.focusWidth?.["width"];
        const focusRing = t?.colors?.["focus-ring"];
        const focusOffset = t?.focusOffset?.["offset"];

        const shell: Record<string, string | undefined> = {
          appearance: "none",
          display: "inline-block",
          position: "relative",
          "vertical-align": "middle",
          cursor: "pointer",
          flex: "none",
          // A circle, from its own box: half the size. `radius.md` on a 20px
          // control is a squircle.
          ...(size !== undefined
            ? {
              width: size,
              height: size,
              "border-radius": "50%",
            }
            : {}),
          ...(field !== undefined ? { "background-color": field } : {}),
          ...(borderWidth !== undefined && border !== undefined
            ? { border: `${borderWidth} solid ${border}` }
            : {}),
          ...(duration !== undefined
            ? { "transition-duration": duration }
            : {}),
          ...(easing !== undefined
            ? { "transition-timing-function": easing }
            : {}),
        };
        if (duration !== undefined) {
          Object.assign(shell, {
            "transition-property": "background-color, border-color",
          });
        }
        yield {
          [ctx.symbols.selector]: () => 'input[type="radio"]',
          ...shell,
        };

        // The field box pads every text-like input, and the radio's own rule
        // above never mentions padding — so the box's padding lands on the
        // radio. This yield's `padding: 0` beats it on specificity.
        yield {
          [ctx.symbols.selector]: () => 'input[type="radio"]',
          padding: "0",
          ...(size !== undefined
            ? { width: size, height: size, "border-radius": "50%" }
            : {}),
        };

        // The dot, daisy-style: a ring, a gap, then the dot. The box keeps a
        // surface fill and takes the tone in its BORDER; the `::after` is a
        // smaller circle in the same tone, centred by `inset: 0` + `margin:
        // auto` with its size inset from the box so the gap reads. Our old
        // form filled box and dot both primary — a solid disc with no
        // separation, which reads as a blob rather than a selected radio.
        // Hidden by scaling to nothing rather than by opacity, so it animates
        // the way the tick does — the mark appearing IS the state.
        const dot: Record<string, string | undefined> = {
          content: '""',
          position: "absolute",
          inset: "0",
          margin: "auto",
          "border-radius": "50%",
          // A fraction of the box, so a size change carries the dot with it
          // and the gap survives in every theme including heavy borders.
          ...(size !== undefined
            ? { width: `calc(${size} / 2)`, height: `calc(${size} / 2)` }
            : {}),
          ...(primary !== undefined ? { "background-color": primary } : {}),
          scale: "0",
          ...(duration !== undefined
            ? { "transition-duration": duration }
            : {}),
          ...(easing !== undefined
            ? { "transition-timing-function": easing }
            : {}),
        };
        if (duration !== undefined) {
          Object.assign(dot, { "transition-property": "scale" });
        }
        yield {
          [ctx.symbols.selector]: () => 'input[type="radio"]::after',
          ...dot,
        };

        yield {
          [ctx.symbols.selector]: () => 'input[type="radio"]:checked::after',
          scale: "1",
        };
        // Checked takes the tone in the BORDER, not the fill: the box keeps
        // its surface so the gap between ring and dot reads, and the control
        // is a ring with a dot rather than a solid disc.
        yield {
          [ctx.symbols.selector]: () => 'input[type="radio"]:checked',
          ...(primary !== undefined ? { "border-color": primary } : {}),
        };
        yield {
          [ctx.symbols.selector]: () => 'input[type="radio"]:focus-visible',
          ...(focusWidth !== undefined && focusRing !== undefined
            ? { outline: `${focusWidth} solid ${focusRing}` }
            : {}),
          ...(focusOffset !== undefined
            ? { "outline-offset": focusOffset }
            : {}),
        };
        yield {
          [ctx.symbols.selector]: () => 'input[type="radio"]:disabled',
          cursor: "not-allowed",
          // Flatten with the checkbox: a control you cannot press should
          // not carry the shadows that say it can be.
          "box-shadow": "none",
          opacity: "0.4",
        };
      },
      { layer: "primitives", autocomplete: "radio" },
    ],
  ];
}
