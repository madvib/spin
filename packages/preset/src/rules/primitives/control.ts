import type { SpinRule } from "../../utils/lookup.ts";
import { disabledPosture, focusPaint, focusRing } from "./shared.ts";

/**
 * Checkbox and switch — the two controls a theme has real decisions about.
 *
 * Neither is `accent-color`. Both draw themselves: `appearance: none`, then a
 * mark or a thumb made from a pseudo-element, animated between two states. The
 * browser's own rendering is never themed, so a tick cannot be the platform's
 * blue and a switch cannot be a tinted box.
 *
 * Two techniques carry both, and both are load-bearing rather than decoration:
 *
 * **The tick is a clip-path, not a glyph.** A rotated square whose visible
 * area is a polygon animating between two shapes — the tick draws itself in,
 * and the tick's weight comes from the polygon's own geometry rather than from
 * a font that may not be loaded. `@starting-style` lets that transition run on
 * first paint, so a checked box on page load animates like one that was
 * clicked.
 *
 * **The thumb travels on a grid, not a translate.** `grid-template-columns`
 * goes from `0fr 1fr 1fr` to `1fr 1fr 0fr`, and the thumb is the middle cell.
 * The grid does the arithmetic, so the thumb cannot overshoot the track or
 * stop short of it — a stated `translate` distance is only as correct as the
 * number someone wrote down. Ours was: it stopped 0.375em short, because the
 * thumb size was subtracted by hand from a track width that had already had
 * the border taken out of it twice.
 *
 * Every declaration reads the theme. Sizes and colours the theme omits drop
 * their declaration rather than falling back to a value the theme did not
 * state.
 */
export function controlRules(roots: readonly string[]): SpinRule[] {
  return [
    ...(roots.includes("checkbox") ? [checkboxRule()] : []),
    ...(roots.includes("switch") ? [switchRule()] : []),
  ];
}

/**
 * The tick geometry.
 *
 * A 45°-rotated square, clipped to a shape. The unchecked polygon is a short
 * bar with no middle; the checked polygon raises the middle, which is the
 * tick's elbow. The percentages are the shape, not the state — animating them
 * is what makes the mark appear to be drawn.
 */
const TICK_OFF =
  "polygon(20% 100%, 20% 80%, 50% 80%, 50% 80%, 70% 80%, 70% 100%)";
const TICK_ON = "polygon(20% 100%, 20% 80%, 50% 80%, 50% 0%, 70% 0%, 70% 100%)";
const TICK_MIXED =
  "polygon(20% 100%, 20% 80%, 50% 80%, 50% 80%, 80% 80%, 80% 100%)";

function checkboxRule(): SpinRule {
  return [
    /^checkbox$/,
    function* (_m, ctx) {
      const size = ctx?.theme?.spacing?.[4];
      const radius = ctx?.theme?.radius?.sm;
      const text = ctx?.theme?.color?.text;
      const primary = ctx?.theme?.color?.primary;
      const onPrimary = ctx?.theme?.color?.["on-primary"];
      const border = ctx?.theme?.color?.border;
      const duration = ctx?.theme?.motion?.duration?.fast;
      const easing = ctx?.theme?.motion?.easing?.standard;
      const borderWidth = ctx?.theme?.border?.width;
      const ring = focusRing(ctx);

      // Depth is three inset shadows driven by one scalar rather than a
      // single drop shadow. A dark inner line at the bottom edge is what makes
      // a box read as pressed into the page, a light one at the top edge
      // catches the light, and the spread shadow separates the box from
      // whatever sits behind it. A drop shadow alone gives a box that floats
      // and never looks like it is made of a surface.
      // Static: `depth` is a fixed step name, not a class suffix.
      const depth = ctx?.theme?.checkbox?.depth ?? "1.5";

      const shell = {
        appearance: "none",
        display: "inline-block",
        position: "relative",
        // The field box pads every text-like input, and it states the control
        // height floor. A checkbox is a drawn box of its own size: it takes
        // both back, or the floor would stretch a 16px square to 34px.
        padding: "0",
        width: "auto",
        "min-height": "0",
        // `vertical-align: middle` aligns to the baseline plus half an
        // x-height, which lands a box half a pixel off the line's centre
        // against a fractional font size. These are controls, not inline
        // prose: they align to the text baseline, and how far above that they
        // sit is the line box's business, not the control's.
        "vertical-align": "-0.125em",
        cursor: "pointer",
        flex: "none",
        ...(size !== undefined ? { width: size, height: size } : {}),
        ...(radius !== undefined ? { "border-radius": radius } : {}),
        ...(borderWidth !== undefined && border !== undefined
          ? { border: `${borderWidth} solid ${border}` }
          : {}),
        ...(text !== undefined ? { color: text } : {}),
        // The dark line sits at the bottom edge and the light one at the top,
        // because light falls from above. Both are insets, so they read as the
        // box's own surfaces rather than as a shadow cast by something else.
        "box-shadow": [
          `inset 0 1px 2px 0 rgba(0, 0, 0, calc(${depth} * 0.1))`,
          `inset 0 -1px 0 0 rgba(255, 255, 255, calc(${depth} * 0.1))`,
          `inset 0 0 0 0 rgba(0, 0, 0, 0)`,
          `0 0 0 0 rgba(0, 0, 0, 0)`,
        ].join(", "),
        ...(duration !== undefined ? { "transition-duration": duration } : {}),
        ...(easing !== undefined
          ? { "transition-timing-function": easing }
          : {}),
      };
      if (duration !== undefined) {
        Object.assign(shell, {
          "transition-property": "background-color, box-shadow, border-color",
        });
      }

      yield {
        [ctx.symbols.selector]: () => 'input[type="checkbox"]:not([role])',
        ...shell,
      };

      // The mark. `rotate` stays constant at 45° — the polygon's own geometry
      // is what changes, so the tick's weight is the theme-independent
      // percentages above rather than whatever a font renders.
      // The mark is inset from the box, not flush with it. A tick drawn edge
      // to edge fills the box and reads as a blob; leaving the box visible
      // around it is what makes it read as a tick inside something.
      //
      // An eighth, and smaller than instinct suggests, because the mark is a
      // 45°-ROTATED square: rotating shrinks its axis-aligned footprint, so a
      // third or a fifth of the control on each side leaves a speck rather
      // than a tick. A fraction of the control's own size, so a size change
      // carries the mark with it.
      const inset = size === undefined ? "0" : `calc(${size} / 8)`;
      const mark = {
        content: '""',
        display: "block",
        position: "absolute",
        inset,
        "background-color": "currentColor",
        opacity: "0",
        rotate: "45deg",
        "transform-origin": "center",
        "clip-path": TICK_OFF,
      };
      if (duration !== undefined) {
        Object.assign(mark, {
          "transition-property": "clip-path, opacity, scale",
          "transition-duration": duration,
          "transition-timing-function": easing ?? "linear",
          // The mark lags the fill slightly, so the fill reads first and the
          // tick is drawn into it rather than appearing alongside.
          "transition-delay": duration,
        });
      }
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"]:not([role])::before',
        ...mark,
      };

      // Checked: the light top inset goes and the dark one compresses, so a
      // filled box reads as pressed rather than as a painted one.
      const on = {
        ...(primary !== undefined
          ? { "background-color": primary, "border-color": primary }
          : {}),
        ...(onPrimary !== undefined ? { color: onPrimary } : {}),
        "box-shadow": [
          `inset 0 0 0 0 rgba(0, 0, 0, 0)`,
          `inset 0 -1px 0 0 rgba(255, 255, 255, 0)`,
          `inset 0 8px 0 -4px rgba(255, 255, 255, calc(${depth} * 0.1))`,
          `inset 0 1px 0 0 rgba(0, 0, 0, calc(${depth} * 0.1))`,
        ].join(", "),
      };
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"]:not([role]):checked',
        ...on,
      };
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"]:not([role]):indeterminate',
        ...on,
      };

      // The ring, drawn on focus-visible so a mouse press leaves none. And
      // the ring IS the control's edge: the box's own border takes the
      // ring's ink while it is focused, so the reader sees one edge in the
      // theme's focus colour rather than the box's edge with a second band
      // beside it. It is stated AFTER the checked state, because a focused
      // control says where it is before it says what it is.
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"]:not([role]):focus-visible',
        ...focusPaint(ring),
      };

      // A 45°-rotated square has its visual mass below its geometric centre,
      // so a tick drawn inside it reads as sitting low in the box unless the
      // drawn shape is lifted. The lift is on the clip-path, not on the
      // element: `translate` would be animated by the state transition and
      // fight the clip-path's own.
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"]:not([role]):checked::before',
        opacity: "1",
        ...(borderWidth !== undefined
          ? { translate: `0 -${borderWidth}` }
          : {}),
        "clip-path": TICK_ON,
      };
      // The mixed mark is a bar, not a tick: no rotation, and it sits higher.
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"]:not([role]):indeterminate::before',
        opacity: "1",
        rotate: "0deg",
        scale: "1 0.5",
        "clip-path": TICK_MIXED,
      };

      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"]:not([role]):is(:disabled, [aria-disabled="true"])',
        cursor: "not-allowed",
        // The depth goes with the interaction: a box you cannot press should
        // not have the shadows that say it can be.
        "box-shadow": "none",
        // A dead control wears a posture, not a dim: the theme's disabled
        // fill and the ink that reads on it. The tick is drawn in the
        // control's own ink, so it wears the dead ink with it.
        ...disabledPosture(ctx),
      };
    },
    { layer: "primitives", autocomplete: "checkbox" },
  ];
}

/**
 * The switch.
 *
 * The track is a three-column grid whose middle column holds the thumb. Off
 * is `0fr 1fr 1fr` — the thumb is squeezed into nothing and sits at the
 * start; on is `1fr 1fr 0fr`, and it moves to the other end. Because the grid
 * is what moves, the thumb's end position is whatever the track size makes it;
 * there is no distance to state and therefore none to get wrong.
 *
 * The track's radius is derived from the thumb's, not fixed: a fully-round
 * track has to be pill-shaped, so its radius is the thumb radius plus the
 * track's padding. That keeps the thumb from spilling past the track's curve
 * at any size.
 */
function switchRule(): SpinRule {
  return [
    /^switch$/,
    function* (_m, ctx) {
      const size = ctx?.theme?.spacing?.[4];
      const borderWidth = ctx?.theme?.border?.width;
      const radius = ctx?.theme?.radius?.md;
      const radiusFull = ctx?.theme?.radius?.full;
      const border = ctx?.theme?.color?.border;
      const text = ctx?.theme?.color?.text;
      const muted = ctx?.theme?.color?.["text-muted"];
      const raised = ctx?.theme?.color?.["surface-raised"];
      const primary = ctx?.theme?.color?.primary;
      const onPrimary = ctx?.theme?.color?.["on-primary"];
      const shadow = ctx?.theme?.shadow?.sm;
      const duration = ctx?.theme?.motion?.duration?.fast;
      const easing = ctx?.theme?.motion?.easing?.standard;
      const ring = focusRing(ctx);

      const shell: Record<string, string | undefined> = {
        appearance: "none",
        display: "inline-grid",
        // As with the checkbox: the field box's width, padding and height
        // floor are undone here, on this rule, because this rule is what
        // knows the track's size.
        padding: "0",
        width: "auto",
        "min-height": "0",
        "grid-template-columns": "0fr 1fr 1fr",
        position: "relative",
        cursor: "pointer",
        "vertical-align": "middle",
        "user-select": "none",
        // The thumb needs somewhere to sit: padding on the track is what
        // keeps it off the border, and the grid columns are what move it.
        "justify-items": "center",
        "align-items": "center",
        ...(borderWidth !== undefined ? { padding: borderWidth } : {}),
        ...(borderWidth !== undefined && border !== undefined
          ? { border: `${borderWidth} solid ${border}` }
          : {}),
        // Twice the size, less the border on each side: the control is twice
        // as wide as it is tall, which is the whole proportion of a switch.
        ...(size !== undefined && borderWidth !== undefined
          ? { width: `calc((${size} * 2) - ${borderWidth} * 2)`, height: size }
          : size !== undefined
          ? { width: `calc(${size} * 2)`, height: size }
          : {}),
        // The track is as round as its thumb is wide, so the curve never
        // clips the thumb. Deriving it means a size change cannot desync them.
        ...(radiusFull !== undefined && radius !== undefined
          ? { "border-radius": `calc(${radiusFull} + ${radius})` }
          : radiusFull !== undefined
          ? { "border-radius": radiusFull }
          : {}),
        ...(raised !== undefined ? { "background-color": raised } : {}),
        // The theme's own physical language: `shadow.sm` is a soft lift in
        // one language, a hard offset edge in another, a phosphor ring in
        // the third — so a switch reads as its theme's object rather than
        // as one control's private idea of depth.
        ...(shadow !== undefined ? { "box-shadow": shadow } : {}),
      };
      if (duration !== undefined) {
        Object.assign(shell, {
          // The grid is what moves, so the grid is what transitions.
          "transition-property":
            "grid-template-columns, background-color, border-color",
          "transition-duration": duration,
          "transition-timing-function": easing ?? "linear",
        });
      }

      yield {
        [ctx.symbols.selector]: () => 'input[type="checkbox"][role="switch"]',
        ...shell,
      };

      // The thumb. It is the grid's own cell, so it never needs a travel
      // distance stated — the grid's columns place it, and the only size it
      // needs is how big it is, which is the track's height less the border
      // and the padding. Stating that as a calc is what keeps the thumb inside
      // the track: `height: 100%` would make it as tall as the track's
      // border-box and it would sit flush against the edges.
      const thumb: Record<string, string | undefined> = {
        content: '""',
        "grid-column": "2",
        "grid-row": "1",
        display: "block",
        // Centred in its own grid cell rather than pinned to a track offset,
        // so the thumb is always the gap between the two fixed columns.
        "align-self": "center",
        // `inherit` would take the thumb's shape from the track, and a theme
        // with square radii then renders a square thing sliding inside a pill —
        // which reads as a mistake rather than as a switch. The TRACK follows
        // the theme; the thumb is round in every theme, because that is what
        // makes it a thumb.
        "border-radius": "50%",
        // The thumb is the track's height less the border on each side and
        // one eighth for the padding between thumb and track. A fraction of
        // the track rather than a stated length, so a size change carries the
        // thumb with it instead of leaving the gap behind.
        ...(size !== undefined && borderWidth !== undefined
          ? {
            height: `calc(${size} - ${borderWidth} * 2 - ${size} / 8)`,
            width: `calc(${size} - ${borderWidth} * 2 - ${size} / 8)`,
          }
          : {}),
        // The off thumb is the text colour at half strength, not a solid
        // grey. A translucent thumb takes its colour from the track behind it,
        // so one token reads correctly whether the track is empty or filled
        // and the thumb cannot be a colour that only suits one of them.
        ...(text !== undefined ? { "background-color": text } : {}),
        opacity: "0.5",
      };
      if (duration !== undefined) {
        Object.assign(thumb, {
          "transition-property": "background-color",
          "transition-duration": duration,
          "transition-timing-function": easing ?? "linear",
        });
      }
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"][role="switch"]::before',
        ...thumb,
      };

      // On: the grid swaps its columns and the track takes the primary.
      const onGrid: Record<string, string | undefined> = {
        "grid-template-columns": "1fr 1fr 0fr",
        ...(primary !== undefined
          ? { "background-color": primary, "border-color": primary }
          : {}),
        // Pressed: the fill takes the primary and the edge goes with it,
        // while the shadow stays the theme's own — a checked switch is the
        // same object, lit, not a different one.
        ...(shadow !== undefined ? { "box-shadow": shadow } : {}),
        ...(onPrimary !== undefined ? { color: onPrimary } : {}),
      };
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"][role="switch"]:checked',
        ...onGrid,
      };
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"][role="switch"]:checked::before',
        // Opaque on, because the track behind it is now the primary and the
        // thumb has to sit on it as a solid object rather than tint it.
        opacity: "1",
        ...(onPrimary !== undefined ? { "background-color": onPrimary } : {}),
      };

      // The ring, drawn on focus-visible so a mouse press leaves none. And
      // the ring IS the control's edge: the track's own border takes the
      // ring's ink while it is focused, so the reader sees one edge in the
      // theme's focus colour rather than the track's edge with a second band
      // beside it.
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"][role="switch"]:focus-visible',
        ...focusPaint(ring),
      };
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"][role="switch"]:is(:disabled, [aria-disabled="true"])',
        cursor: "not-allowed",
        // The depth goes with the interaction, as it does on the checkbox.
        "box-shadow": "none",
        // A dead control wears a posture, not a dim: the theme's disabled
        // fill and the ink that reads on it.
        ...disabledPosture(ctx),
      };
      // And the thumb wears that ink with the track: the thumb is drawn in
      // the control's own colour, so a dead switch is dead all the way
      // through instead of keeping a live thumb on a dead track.
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"][role="switch"]:is(:disabled, [aria-disabled="true"])::before',
        "background-color": "currentColor",
      };
      // An indeterminate switch has no middle position to sit at, so the grid
      // halves rather than choosing one for it.
      yield {
        [ctx.symbols.selector]: () =>
          'input[type="checkbox"][role="switch"]:indeterminate',
        "grid-template-columns": "0.5fr 1fr 0.5fr",
      };
      // Unset colours must not leave the thumb invisible against the track.
      if (text === undefined && muted !== undefined) {
        yield {
          [ctx.symbols.selector]: () =>
            'input[type="checkbox"][role="switch"]::before',
          "background-color": muted,
        };
      }
    },
    { layer: "primitives", autocomplete: "switch" },
  ];
}
