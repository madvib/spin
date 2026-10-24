import type { Rule } from "@unocss/core";
import { type ThemeContext, token } from "../../utils/lookup.ts";
import {
  disabledPosture,
  focusPaint,
  focusRing,
  withFallback,
} from "./shared.ts";

/**
 * The tokens a field box spends. Absent ones drop their declaration rather
 * than falling back to a value the theme did not state.
 *
 * Shared by every text-like field — input, textarea — because they are one box
 * with two contents. That shared box is `shared.ts`; what is here is only
 * what belongs to `<input>` itself.
 *
 * The focus ring is not here: it is the ring every interactive element
 * shares, and it is read through `shared.ts` so the field and the button
 * cannot paint two different rings.
 */
export interface FieldTokens {
  readonly spacing2: string | undefined;
  readonly radius: string | undefined;
  readonly fontFamily: string | undefined;
  readonly fontSize: string | undefined;
  readonly text: string | undefined;
  readonly muted: string | undefined;
  readonly field: string | undefined;
  readonly edge: string | undefined;
  readonly border: string | undefined;
  readonly borderWidth: string | undefined;
  readonly duration: string | undefined;
  readonly easing: string | undefined;
  readonly primary: string | undefined;
  readonly success: string | undefined;
  readonly error: string | undefined;
}

export function fieldTokens(ctx: ThemeContext | undefined): FieldTokens {
  return {
    spacing2: token(ctx, "spacing.2"),
    radius: withFallback(ctx, "field.radius", "radius.md"),
    fontFamily: token(ctx, "font.family.sans"),
    fontSize: token(ctx, "font.size.md"),
    text: token(ctx, "color.text"),
    muted: token(ctx, "color.text-muted"),
    field: token(ctx, "color.field"),
    // The field's own edge. A control must read as a control, so the line
    // it wears is the field's own ink (`field.border`), falling back to the
    // role the system keeps for it: one step stronger than a divider.
    edge: withFallback(ctx, "field.border", "color.border-strong"),
    border: token(ctx, "color.border"),
    borderWidth: token(ctx, "border.width"),
    duration: token(ctx, "motion.duration.fast"),
    easing: token(ctx, "motion.easing.standard"),
    primary: token(ctx, "color.primary"),
    success: token(ctx, "color.semantic.success"),
    error: token(ctx, "color.semantic.error"),
  };
}

/** Every control that renders a field box: the two text-like elements. */
export const FIELDS = ":is(input, textarea)";

/**
 * The fields that are one line of text and therefore one control height.
 *
 * A textarea is a box of prose and grows with its lines; a checkbox, radio
 * and range are drawn controls with sizes of their own; a submit, reset,
 * button, file, image or hidden input is not a text field at all. What is
 * left is the set whose height is the button's: one line, one padding step,
 * one border.
 */
export const CONTROL_FIELDS =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="file"]):not([type="image"]):not([type="hidden"])';

/**
 * The types that need opting out of the field box entirely.
 *
 * Only the ones with no box of their own: a submit button is a button, an
 * image input is replaced by its image. A checkbox, radio, range and colour
 * control are NOT here — each is drawn by its own rule which states its own
 * width, and this selector is more specific than theirs (`:is(a):is(b)` beats
 * `:is(a)`), so listing them deleted the size they had just declared and left
 * a 2px sliver. An exhaustive list of the ones that opt out, rather than of
 * the ones that opt in, so a new `type` is padded by default — which is the
 * right default for a text field.
 */
export const BOX_TYPES =
  'input[type="range"], input[type="submit"], input[type="reset"], input[type="button"], input[type="file"], input[type="image"], input[type="hidden"]';

/**
 * The box every text-like field shares: its surface, border, radius,
 * typography, placeholder, focus ring, and the three validity colours.
 *
 * It is yielded from the `input` rule rather than declared once and reused,
 * because uno keeps only the first rule matching a token — a second rule for
 * the ring would never fire. The cost is that `<textarea>` inherits it, which
 * is the intent: they are the same box.
 *
 * Validity is three colours, not two. `aria-invalid` with no value means the
 * state is unknown, and a field that has not been judged yet should not be
 * shown as wrong: it gets the primary border, which says "live" without
 * claiming an answer. `false` is a pass and `true` is a failure.
 */
export function fieldBox(): Rule {
  const rule: Rule = [
    /^(?:input|textarea)$/,
    function* (_m, context) {
      const {
        spacing2,
        edge,
        radius,
        fontFamily,
        fontSize,
        text,
        muted,
        field,
        border,
        borderWidth,
        duration,
        easing,
        primary,
        success,
        error,
      } = fieldTokens(context);
      const ring = focusRing(context);

      const box: Record<string, string | undefined> = {
        "font-family": fontFamily,
        "font-size": fontSize,
        color: text,
        "background-color": field,
        "border-radius": radius,
        width: "100%",
        // The control-height floor, from the same three theme values the
        // button derives it from: a field beside a button is the same object
        // at the same height, in every starter, whatever the theme's leading.
        ...(fontSize !== undefined && spacing2 !== undefined &&
            borderWidth !== undefined
          ? {
            "min-height":
              `calc(${fontSize} + (2 * ${spacing2}) + (2 * ${borderWidth}))`,
          }
          : {}),
      };
      // The border shorthand is stated only when both halves resolve, so a
      // theme missing either states no border rather than an incomplete one.
      if (borderWidth !== undefined && border !== undefined) {
        Object.assign(box, { border: `${borderWidth} solid ${border}` });
      }
      // A control must read as a control. `color.border` is a hairline meant
      // for dividing content, and at 1px on a white field it is close to
      // invisible — which is how a textarea ends up on screen and still looks
      // like nothing. So a field states its own edge (`field.border`), one
      // step stronger than a divider by default, spent AFTER the shorthand so
      // the colour is the one that wins.
      if (edge !== undefined) {
        Object.assign(box, { "border-color": edge });
      }
      if (spacing2 !== undefined) {
        Object.assign(box, {
          "padding-block-start": spacing2,
          "padding-block-end": spacing2,
          "padding-inline-start": spacing2,
          "padding-inline-end": spacing2,
        });
      }
      if (duration !== undefined) {
        Object.assign(box, {
          "transition-duration": duration,
          "transition-timing-function": easing ?? "linear",
          // The ring is painted with `outline`, so `outline` is what moves —
          // and the edge, which takes the ring's ink while the field is
          // focused, moves with it.
          "transition-property":
            "color, background-color, border-color, outline",
        });
      }

      yield {
        [context.symbols.selector]: () => FIELDS,
        ...box,
      };

      // The single-line fields set their own leading and their own height. A
      // control's line box is the control's, not the document's: inherited
      // leading made an input taller than every button beside it. `height`
      // rather than `min-height`, because a text input's inner editor keeps a
      // floor of its own font metrics even when the line box is smaller — the
      // one declaration that makes the box the height the theme asked for.
      yield {
        [context.symbols.selector]: () => CONTROL_FIELDS,
        "line-height": "1",
        ...(fontSize !== undefined && spacing2 !== undefined &&
            borderWidth !== undefined
          ? {
            height:
              `calc(${fontSize} + (2 * ${spacing2}) + (2 * ${borderWidth}))`,
          }
          : {}),
      };

      // The box types lay out their own contents and must not be padded or
      // stretched like a text field, including the native range control the
      // inline `bare` style does not cover. The selector IS the list of those
      // types — inverting it with `:not(...)` would zero every text field's
      // padding, which is the opposite of the intent.
      yield {
        [context.symbols.selector]: () => `${FIELDS}:is(${BOX_TYPES})`,
        padding: "0",
        width: "auto",
      };

      // The opt-out for chrome-adjacent inline editing: a borderless input or
      // textarea the surrounding surface owns. It keeps the text and the
      // placeholder and drops the box — surface, edge, rounding, padding,
      // floor and shadow — so `editable` and `tags-input` inline editors read
      // as text, not as a field inside a field.
      yield {
        [context.symbols.selector]: () => `${FIELDS}.bare`,
        "background-color": "transparent",
        border: "none",
        "border-radius": "0",
        "box-shadow": "none",
        padding: "0",
        "min-height": "0",
        height: "auto",
        width: "auto",
      };

      yield {
        [context.symbols.selector]: () => `${FIELDS}::placeholder`,
        ...(muted !== undefined ? { color: muted } : {}),
        opacity: "1",
      };

      // The ring is the field's edge.
      //
      // The border takes the ring's ink, and the ring itself is an OUTLINE:
      // painted outside the field's box, so it never changes the field's
      // size and focusing a field never nudges the page. It stands off the
      // border by the theme's offset, so what the reader sees is ONE edge in
      // the theme's focus colour — a border in one colour with a ring in
      // another, sitting beside it, is a doubled edge that reads as a broken
      // border rather than as focus.
      yield {
        [context.symbols.selector]: () => `${FIELDS}:focus-visible`,
        ...focusPaint(ring),
      };
      // A pointer that lands on a field leaves no ring: the browser's own is
      // not the theme's, so it goes.
      yield {
        [context.symbols.selector]: () => `${FIELDS}:focus:not(:focus-visible)`,
        outline: "none",
      };
      // The same ring for engines without :focus-visible. A rule cannot be
      // wrapped in `@supports` from its body, so the parent symbol carries
      // the at-rule and the selector symbol the fallback selector.
      yield {
        [context.symbols.parent]: "@supports not selector(:focus-visible)",
        [context.symbols.selector]: () => `${FIELDS}:focus`,
        ...focusPaint(ring),
      };

      // An unjudged field: attention without judgement.
      yield {
        [context.symbols.selector]: () =>
          `${FIELDS}[aria-invalid]:not([aria-invalid="true"]):not([aria-invalid="false"])`,
        ...(primary !== undefined ? { "border-color": primary } : {}),
      };
      yield {
        [context.symbols.selector]: () => `${FIELDS}[aria-invalid="false"]`,
        ...(success !== undefined ? { "border-color": success } : {}),
      };
      yield {
        [context.symbols.selector]: () => `${FIELDS}[aria-invalid="true"]`,
        ...(error !== undefined ? { "border-color": error } : {}),
      };

      // A dead field wears the posture: the theme's disabled fill and the
      // ink that reads on it. A field is a control like any other, and a
      // dimmed one dims the text a reader is meant to transcribe — the one
      // thing a field that cannot be typed into still has to be good for.
      yield {
        [context.symbols.selector]: () =>
          `${FIELDS}:is(:disabled, [aria-disabled="true"])`,
        ...disabledPosture(context),
        cursor: "not-allowed",
      };
    },
    { layer: "primitives", autocomplete: "field" },
  ];
  return rule;
}
