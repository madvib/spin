import type { SpinRule, ThemeContext } from "../../utils/lookup.ts";
import {
  controlHeight,
  disabledPosture,
  fallback,
  focusPaint,
  focusRing,
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
  // The field's type is the field's own tuple — what a reader typed, read
  // at the body step.
  const body = ctx?.theme?.field?.type ?? ctx?.theme?.font?.style?.body;
  return {
    spacing2: ctx?.theme?.spacing?.[2],
    radius: fallback(ctx?.theme?.field?.radius, ctx?.theme?.radius?.md),
    fontFamily: body?.["font-family"],
    fontSize: body?.["font-size"],
    text: ctx?.theme?.color?.text,
    muted: ctx?.theme?.color?.["text-muted"],
    field: ctx?.theme?.color?.field,
    // The field's own edge. A control must read as a control, so the line
    // it wears is the field's own ink (`field.border`), falling back to the
    // role the system keeps for it: one step stronger than a divider.
    edge: fallback(ctx?.theme?.field?.border, ctx?.theme?.color?.["border-strong"]),
    border: ctx?.theme?.color?.border,
    borderWidth: ctx?.theme?.border?.width,
    duration: ctx?.theme?.motion?.duration?.fast,
    easing: ctx?.theme?.motion?.easing?.standard,
    primary: ctx?.theme?.color?.primary,
    success: ctx?.theme?.color?.semantic?.success,
    error: ctx?.theme?.color?.semantic?.error,
  };
}

/** Every control that renders a field box: the text-like elements plus select. */
export const FIELDS = ":is(input, textarea, select)";

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
export function fieldBox(): SpinRule {
  const rule: SpinRule = [
    /^(?:input|textarea|select)$/,
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

      // The shared control-height floor: the tallest of the body and label
      // voices' line boxes, plus the shared padding step and edge weight —
      // the same floor the button spends, so the two land at one height in
      // every row they share. Named styles, never component tuples, so the
      // field spends only what its vocabulary owns.
      const floor = controlHeight(
        {
          fontSize: context?.theme?.font?.style?.body?.["font-size"],
          fontLeading: context?.theme?.font?.style?.body?.["line-height"],
        },
        {
          fontSize: context?.theme?.font?.style?.label?.["font-size"],
          fontLeading: context?.theme?.font?.style?.label?.["line-height"],
        },
        { spacing: spacing2, borderWidth },
      );
      const box: Record<string, string | undefined> = {
        "font-family": fontFamily,
        "font-size": fontSize,
        color: text,
        "background-color": field,
        "border-radius": radius,
        width: "100%",
        // The shared floor, spent on the box too so a bare field in a grid
        // or form row matches the button beside it — not only the
        // single-line yield below.
        ...(floor !== undefined
          ? {
            "min-height": floor,
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

      // The single-line fields set their own leading and the shared floor. A
      // control's line box is the control's, not the document's: inherited
      // leading made an input taller than every button beside it. `min-height`
      // rather than the `height` this yield used to state, because a fixed
      // height stops flex parents from stretching the shorter control to its
      // sibling — a `.join` input beside a button kept a 2–3px step on the
      // seam. A floor both controls share stretches to the tallest of them.
      yield {
        [context.symbols.selector]: () => CONTROL_FIELDS,
        "line-height": "1",
        ...(floor !== undefined
          ? {
            "min-height": floor,
          }
          : {}),
      };


      // The size styles, the same steps a button takes. A field's type and
      // padding move with the step; a single-line control also lands on the
      // step's height, while a textarea keeps its own lines. Without this a
      // chrome control had to restate the small metrics at every call site.
      // The type at each step is the field's reading style at that step: sm
      // reads the label size through the label style, lg the subtitle size
      // through the subtitle style (the button's s-lg style), so moving the
      // styles moves the sizes with them.
      const label = context?.theme?.font?.style?.label;
      const subtitle = context?.theme?.font?.style?.subtitle;
      const space1 = context?.theme?.spacing?.[1];
      const space4 = context?.theme?.spacing?.[4];
      for (const [name, size, space] of [
        ["s-sm", label?.["font-size"], space1],
        ["s-lg", subtitle?.["font-size"], space4],
      ] as const) {
        if (size !== undefined) {
          yield {
            [context.symbols.selector]: () => `${FIELDS}.${name}`,
            "font-size": size,
          };
        }
        if (space !== undefined) {
          yield {
            [context.symbols.selector]: () => `${FIELDS}.${name}`,
            "padding-block-start": space,
            "padding-block-end": space,
            "padding-inline-start": space,
            "padding-inline-end": space,
          };
        }
        if (size !== undefined && space !== undefined && borderWidth !== undefined) {
          const height = `calc(${size} + (2 * ${space}) + (2 * ${borderWidth}))`;
          yield {
            [context.symbols.selector]: () => `:is(input, select).${name}`,
            "min-height": height,
          };
        }
      }

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
      // `type=search` keeps the field box. Firefox floors a search field's
      // line box above `line-height: 1`, so the shared floor restated here
      // wins the cascade over the UA's taller search line box — in the same
      // `min-height` shape, so a joined search field still stretches with its
      // submit rather than pinning to a fixed height.
      yield {
        [context.symbols.selector]: () => 'input[type="search"]',
        "line-height": "1",
        ...(floor !== undefined
          ? {
            "min-height": floor,
          }
          : {}),
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
      };
      yield {
        [context.symbols.selector]: () => `:where(input, textarea, select).bare`,
        width: "auto",
      };
      yield {
        [context.symbols.selector]: () => `${FIELDS}.bare:focus-visible, ${FIELDS}.bare:focus`,
        outline: "none",
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
