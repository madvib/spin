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
/**
 * What a radio IS.
 *
 * `<radio>` is the tag; `input[type="radio"]` is the same control written the
 * way the platform spells it. Both match, because a primitive that only
 * matched one of them would be a primitive that only works if you write it the
 * way the library prefers — which is the thing this surface exists to avoid.
 */
const RADIO = ":is(radio, input[type=\"radio\"])";

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
          ...(duration !== undefined ? { "transition-duration": duration } : {}),
          ...(easing !== undefined ? { "transition-timing-function": easing } : {}),
        };
        if (duration !== undefined) {
          Object.assign(shell, {
            "transition-property": "background-color, border-color",
          });
        }
        yield {
          [ctx.symbols.selector]: () => RADIO,
          ...shell,
        };

        // The field box states `width: auto` for every box-shaped input, at
        // the same specificity as the rule above, and it lands later — so the
        // radio's own width was being undone by the rule meant to opt it OUT
        // of field styling. Restating the box on a selector that includes the
        // radio's own state is what settles it: the size follows the control's
        // state rather than fighting the box.
        yield {
          [ctx.symbols.selector]: () =>
            RADIO,
          // The field box's `width: auto` and its padding are undone HERE,
          // on this rule, rather than by being listed in a more specific
          // exclusion selector — a drawn control knows its own size, and the
          // box does not.
          padding: "0",
          ...(size !== undefined
            ? { width: size, height: size, "border-radius": "50%" }
            : {}),
        };

        // The dot. Hidden by scaling to nothing rather than by opacity, so it
        // animates the way the tick does — the mark appearing IS the state.
        const dot: Record<string, string | undefined> = {
          content: '""',
          position: "absolute",
          inset: "0",
          margin: "auto",
          "border-radius": "50%",
          ...(primary !== undefined ? { "background-color": primary } : {}),
          scale: "0",
          ...(duration !== undefined ? { "transition-duration": duration } : {}),
          ...(easing !== undefined ? { "transition-timing-function": easing } : {}),
        };
        if (duration !== undefined) {
          Object.assign(dot, { "transition-property": "scale" });
        }
        yield {
          [ctx.symbols.selector]: () => `${RADIO}::after`,
          ...dot,
        };

        yield {
          [ctx.symbols.selector]: () => `${RADIO}:checked::after`,
          scale: "1",
        };
        // Checked fills the border too, so the ring disappears into the dot's
        // own colour and the control reads as one object rather than a dot
        // inside a ring.
        yield {
          [ctx.symbols.selector]: () => `${RADIO}:checked`,
          ...(primary !== undefined
            ? { "border-color": primary, "background-color": primary }
            : {}),
        };
        yield {
          [ctx.symbols.selector]: () => `${RADIO}:focus-visible`,
          ...(primary !== undefined ? { outline: `2px solid ${primary}` } : {}),
          "outline-offset": "2px",
        };
        yield {
          [ctx.symbols.selector]: () => `${RADIO}:disabled`,
          cursor: "not-allowed",
          opacity: "0.4",
        };
      },
      { layer: "primitives", autocomplete: "radio" },
    ],
  ];
}