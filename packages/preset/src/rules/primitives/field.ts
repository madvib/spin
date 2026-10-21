import type { Rule } from "@unocss/core";
import { type ThemeContext, token } from "../../utils/lookup.ts";
import { disabledPosture, withFallback } from "./shared.ts";

/**
 * The tokens a field box spends. Absent ones drop their declaration rather
 * than falling back to a value the theme did not state.
 *
 * Shared by every text-like field — input, select, textarea — because they
 * are one box with three contents. That shared box is `shared.ts`; what is
 * here is only what belongs to `<input>` itself.
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
  readonly focusWidth: string | undefined;
  readonly focusRing: string | undefined;
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
    focusWidth: token(ctx, "focus.width"),
    focusRing: token(ctx, "color.focus-ring"),
    duration: token(ctx, "motion.duration.fast"),
    easing: token(ctx, "motion.easing.standard"),
    primary: token(ctx, "color.primary"),
    success: token(ctx, "color.semantic.success"),
    error: token(ctx, "color.semantic.error"),
  };
}

/** Every control that renders a field box: the three text-like elements. */
export const FIELDS = ":is(input, select, textarea)";

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
  'input[type="submit"], input[type="reset"], input[type="button"], input[type="file"], input[type="image"], input[type="hidden"]';

/**
 * The box every text-like field shares: its surface, border, radius,
 * typography, placeholder, focus ring, and the three validity colours.
 *
 * It is yielded from the `input` rule rather than declared once and reused,
 * because uno keeps only the first rule matching a token — a second rule for
 * the ring would never fire. The cost is that `<select>` and `<textarea>`
 * inherit it, which is the intent: they are the same box.
 *
 * Validity is three colours, not two. `aria-invalid` with no value means the
 * state is unknown, and a field that has not been judged yet should not be
 * shown as wrong: it gets the primary border, which says "live" without
 * claiming an answer. `false` is a pass and `true` is a failure.
 */
export function fieldBox(): Rule {
  const rule: Rule = [
    /^(?:input|select|textarea)$/,
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
        focusWidth,
        focusRing,
        duration,
        easing,
        primary,
        success,
        error,
      } = fieldTokens(context);

      const box: Record<string, string | undefined> = {
        "font-family": fontFamily,
        "font-size": fontSize,
        color: text,
        "background-color": field,
        "border-radius": radius,
        width: "100%",
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
          "transition-property":
            "color, background-color, border-color, box-shadow",
        });
      }

      yield {
        [context.symbols.selector]: () => FIELDS,
        ...box,
      };

      // The box types lay out their own contents and must not be padded or
      // stretched like a text field. The selector IS the list of those types —
      // inverting it with `:not(...)` would zero every text field's padding,
      // which is the opposite of the intent.
      yield {
        [context.symbols.selector]: () => `${FIELDS}:is(${BOX_TYPES})`,
        padding: "0",
        width: "auto",
      };

      yield {
        [context.symbols.selector]: () => `${FIELDS}::placeholder`,
        ...(muted !== undefined ? { color: muted } : {}),
        opacity: "1",
      };

      // Focus replaces the border rather than sitting beside it, so the ring
      // never changes the field's size.
      yield {
        [context.symbols.selector]: () => `${FIELDS}:focus`,
        outline: "none",
        ...(primary !== undefined ? { "border-color": primary } : {}),
        ...(focusWidth !== undefined && focusRing !== undefined
          ? { "box-shadow": `0 0 0 ${focusWidth} ${focusRing}` }
          : {}),
      };
      yield {
        [context.symbols.selector]: () => `${FIELDS}:focus:not(:focus-visible)`,
        "box-shadow": "none",
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
