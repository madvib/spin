import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Disclosure — `<details>` and `<summary>`.
 *
 * A native element with a real open state, which is why it is a rule rather
 * than a class: there is a state to style, and no JavaScript needed to reach
 * it. The platform owns the behaviour — a disclosure works with scripting
 * disabled, is keyboard operable, and is announced through its native role —
 * so everything here is the surface and none of it is the mechanism.
 *
 * Three opinions, all about what "expanded" looks like rather than about a
 * different animation:
 *
 * **The marker is ours.** The platform triangle is the one part of a native
 * disclosure that looks the same in every browser and belongs to none of them.
 * It is hidden and drawn again as a chevron, so the indicator is the same shape
 * as every other icon in the system and can be themed like one.
 *
 * **The rotation is the state.** A chevron that turns reads as open or closed
 * without the reader needing to parse the angle, and it reads correctly at any
 * size because it scales with the glyph. Two triangles that swap do not.
 *
 * **Only the marker turns.** Rotating the row moves the label's baseline, which
 * reads as the row shifting rather than as a control opening. The label stays
 * put and the indicator moves.
 */
export function disclosureRules(
  roots: readonly string[],
  mode: Mode,
): Rule[] {
  if (!roots.includes("details")) return [];
  const details = claim(mode, "details");
  const summary = claim(mode, "summary");
  return [detailsRule(details, summary), summaryRule(summary, details)];
}

interface Tokens {
  readonly spacing2: string | undefined;
  readonly radius: string | undefined;
  readonly text: string | undefined;
  readonly muted: string | undefined;
  readonly raised: string | undefined;
  readonly border: string | undefined;
  readonly borderWidth: string | undefined;
  readonly duration: string | undefined;
  readonly easing: string | undefined;
}

function tokens(ctx: Parameters<typeof themeOf>[0]): Tokens {
  const t = themeOf(ctx);
  return {
    spacing2: t?.spacing["2"],
    radius: t?.radius?.["md"],
    text: t?.colors["text"],
    muted: t?.colors["text-muted"],
    raised: t?.colors["surface-raised"],
    border: t?.colors["border"],
    borderWidth: t?.borderWidth?.["width"],
    duration: t?.motionDuration?.["fast"],
    easing: t?.motionEasing?.["standard"],
  };
}

/** The container: a surface with a rule, and none of its own state. */
function detailsRule(details: string, summary: string): Rule {
  return [
    /^details$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => details,
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { border: `${t.borderWidth} solid ${t.border}` }
          : {}),
        ...(t.radius !== undefined ? { "border-radius": t.radius } : {}),
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
        ...(t.spacing2 !== undefined
          ? {
            "padding-block-start": t.spacing2,
            "padding-block-end": t.spacing2,
            "padding-inline-start": t.spacing2,
            "padding-inline-end": t.spacing2,
          }
          : {}),
      };
      // The body is inset from the label so the content reads as belonging to
      // it rather than as a sibling that happens to sit underneath. The
      // summary is the only child exempt — it IS the label.
      yield {
        [ctx.symbols.selector]: () =>
          `${details} > :not(${summary}):not(${summary} *)`,
        ...(t.spacing2 !== undefined ? { "padding-block-start": t.spacing2 } : {}),
      };
    },
    { layer: "primitives", autocomplete: "details" },
  ];
}

/**
 * The label: a row, a pointer, and the indicator.
 *
 * The marker cannot be styled, so it is hidden and drawn again as a chevron —
 * a square with two borders on one corner, rotated to point down. The same
 * trick the checkbox uses for its tick, and for the same reason: the shape is
 * geometry rather than a glyph, so it needs no font and scales with the type.
 *
 * Hovering raises the whole label, not just the marker, because the label is
 * the control and the marker is a picture of it.
 */
function summaryRule(summary: string, details: string): Rule {
  return [
    /^summary$/,
    function* (_m, ctx) {
      const t = tokens(ctx);

      yield {
        [ctx.symbols.selector]: () => summary,
        display: "flex",
        "align-items": "center",
        ...(t.spacing2 !== undefined ? { gap: t.spacing2 } : {}),
        cursor: "pointer",
        // Firefox. The webkit marker is a pseudo-element and needs its own
        // declaration below; there is no spelling that reaches both at once,
        // and leaving either in place is how a disclosure ends up with two
        // indicators in three browsers.
        "list-style": "none",
        "font-weight": "600",
        ...(t.text !== undefined ? { color: t.text } : {}),
        ...(t.duration !== undefined ? { "transition-duration": t.duration } : {}),
        ...(t.easing !== undefined
          ? { "transition-timing-function": t.easing }
          : {}),
      };

      yield {
        [ctx.symbols.selector]: () => `${summary}::-webkit-details-marker`,
        display: "none",
      };

      // The focus ring belongs to the row: the row is the control, so the
      // control is what shows focus.
      yield {
        [ctx.symbols.selector]: () => `${summary}:focus-visible`,
        "outline-offset": "2px",
      };

      // The indicator is a chevron drawn from a square's corner — the same
      // construction as the checkbox tick, because it has the same property:
      // the shape is geometry rather than a glyph, so it needs no font and
      // scales with the type.
      //
      // Which angle points which way was measured rather than reasoned about.
      // A square showing its right and bottom borders has one corner at the
      // lower right: 45° points it straight DOWN, and a quarter further
      // (-45°) points it RIGHT — not up. Rotating from a downward chevron
      // cannot reach an upward one, because the shape is symmetric about the
      // diagonal it sits on. So the two states use the two angles that do
      // exist and differ by ninety degrees, and the whole indicator turns
      // between them, which is what reads as "opened" regardless of which
      // direction it lands on.
      const chevron: Record<string, string | undefined> = {
        content: '""',
        display: "block",
        flex: "none",
        width: "0.375em",
        height: "0.375em",
        "border-inline-end": "1.5px solid",
        "border-block-end": "1.5px solid",
        "border-color": t.muted,
        rotate: "45deg",
      };
      if (t.duration !== undefined) {
        Object.assign(chevron, {
          "transition-property": "rotate, border-color",
          "transition-duration": t.duration,
          "transition-timing-function": t.easing ?? "linear",
        });
      }

      yield {
        [ctx.symbols.selector]: () => `${summary}::after`,
        ...chevron,
      };
      yield {
        [ctx.symbols.selector]: () => `${summary}:hover::after`,
        ...(t.text !== undefined ? { "border-color": t.text } : {}),
      };
      // Open: a quarter further on. The turn is the state — the reader sees
      // the indicator move rather than reading its angle, which is what works
      // at any size and in forced-colours mode where the border colour may be
      // overridden entirely.
      yield {
        [ctx.symbols.selector]: () => `${details}[open] > ${summary}::after`,
        rotate: "-45deg",
      };
    },
    { layer: "primitives", autocomplete: "summary" },
  ];
}