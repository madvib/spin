import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Popover — the native `<popover>` element, and `<tooltip>` as its smaller
 * sibling.
 *
 * The platform owns the mechanism. An element with the `popover` attribute and
 * a `popovertarget` button on it is already a disclosure that lives in the top
 * layer: light-dismiss, Escape to close, focus handling and the implicit
 * anchor relationship are the browser's. None of that is reimplemented here —
 * this file is the surface, the entrance, and the backdrop.
 *
 *   <button popovertarget="menu">Open</button>
 *   <popover id="menu" popover>…</popover>
 *
 * CSS owns three things:
 *
 *   The surface. A popover is a card that happens to float, so it is the card
 *   surface — raised, bordered, rounded, elevated — and no more. The UA's own
 *   `[popover]` reset is deliberately left alone; a consumer who wants it
 *   pinned to its trigger uses CSS anchor positioning, which is a placement
 *   decision and not this component's.
 *
 *   The entrance. `dialog-in` and `backdrop-in` from `@spin/animation` are
 *   exactly a panel arriving and a scrim fading — no new keyframes are
 *   declared here, because keyframes are the one global namespace in CSS and
 *   `@spin/animation` is its single owner.
 *
 *   The exit. A popover leaving the top layer skips a transition unless the
 *   discrete `display`/`overlay` properties are allowed to transition, so
 *   `transition-behavior: allow-discrete` is what makes the way out animate
 *   too.
 *
 * `@starting-style` is what makes the enter transition run on FIRST open. A
 * top-layer element has no previous style to transition from, so without it
 * the popover would appear at full size the first time and only animate on
 * subsequent opens; the block below supplies the "before" state.
 *
 * A `<tooltip>` is the same surface in a smaller box, revealed by the trigger
 * that precedes it in the markup. The trigger is matched structurally —
 * `:has(+ tooltip)` — rather than by tag, so the component claims no element
 * it does not own.
 */
export function popoverRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("popover")) return [];
  return [popoverRule(mode), tooltipRule(mode)];
}

function popoverTokens(ctx: Parameters<typeof themeOf>[0]) {
  const t = themeOf(ctx);
  return {
    spacing1: t?.spacing["1"],
    spacing2: t?.spacing["2"],
    spacing4: t?.spacing["4"],
    radiusSm: t?.radius?.["sm"],
    radiusLg: t?.radius?.["lg"],
    text: t?.colors["text"],
    raised: t?.colors["surface-raised"],
    border: t?.colors["border"],
    borderWidth: t?.borderWidth?.["width"],
    shadowSm: t?.shadow?.["sm"],
    shadowLg: t?.shadow?.["lg"],
    duration: t?.motionDuration?.["base"],
    easing: t?.motionEasing?.["standard"],
    zDropdown: t?.zIndex?.["dropdown"],
    sizeXs: t?.fontSize?.["xs"],
  };
}

/** The popover panel, its backdrop, and the entrance between them. */
function popoverRule(mode: Mode): Rule {
  const popover = claim(mode, "popover");
  return [
    /^popover$/,
    function* (_m, ctx) {
      const t = popoverTokens(ctx);

      // The panel. A card, floating — the surface is the whole of it; the
      // placement belongs to the platform or to the caller's anchor.
      //
      // `display` is declared ONLY on the open state. The platform hides a
      // closed popover with `display: none`, and an unconditional declaration
      // here would outrank that UA rule and leave every closed popover
      // painted on the page.
      yield {
        [ctx.symbols.selector]: () => popover,
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { border: `${t.borderWidth} solid ${t.border}` }
          : {}),
        ...(t.radiusLg !== undefined ? { "border-radius": t.radiusLg } : {}),
        ...(t.shadowLg !== undefined ? { "box-shadow": t.shadowLg } : {}),
        ...(t.spacing4 !== undefined ? { padding: t.spacing4 } : {}),
        // `display` is discrete: it flips instantly unless allowed to
        // transition, which would cut the exit short. A card is a block —
        // inherited as `inline` the box has no vertical padding at all, the
        // text sits on the border — and there is no `display` for
        // `allow-discrete` to make discrete unless this state states one.
        "transition-property": "opacity, transform, display",
        "transition-behavior": "allow-discrete",
        ...(t.duration !== undefined
          ? { "transition-duration": t.duration }
          : {}),
        ...(t.easing !== undefined
          ? { "transition-timing-function": t.easing }
          : {}),
      };

      // The scrim. A popover sits above the page and the page should read as
      // behind it, not gone — so the veil is the theme's own ink at a low
      // alpha, which inverts with the theme.
      yield {
        [ctx.symbols.selector]: () => `${popover}::backdrop`,
        ...(t.text !== undefined
          ? { background: `color-mix(in oklab, ${t.text} 45%, transparent)` }
          : {}),
        "transition-property": "opacity",
        "transition-behavior": "allow-discrete",
        ...(t.duration !== undefined
          ? { "transition-duration": t.duration }
          : {}),
        ...(t.easing !== undefined
          ? { "transition-timing-function": t.easing }
          : {}),
      };

      // The entrance. Keyframes run on the way in; the transition above runs
      // on the way out, because a keyframe has no "closed" state to leave to.
      // `display: block` rides here, on the open state, so the closed
      // popover keeps the platform's `display: none`.
      yield {
        [ctx.symbols.selector]: () => `${popover}:popover-open`,
        display: "block",
        ...(t.duration !== undefined
          ? {
            animation: `dialog-in ${t.duration} ${t.easing ?? "linear"}`,
          }
          : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${popover}:popover-open::backdrop`,
        ...(t.duration !== undefined
          ? {
            animation: `backdrop-in ${t.duration} ${t.easing ?? "linear"}`,
          }
          : {}),
      };

      // The enter transition's starting values. Without this a top-layer
      // element has nothing to transition from on its first open.
      yield {
        [ctx.symbols.parent]: "@starting-style",
        [ctx.symbols.selector]: () => `${popover}:popover-open`,
        opacity: "0",
        transform: "translateY(0.5rem) scale(0.98)",
      };
      yield {
        [ctx.symbols.parent]: "@starting-style",
        [ctx.symbols.selector]: () => `${popover}:popover-open::backdrop`,
        opacity: "0",
      };
    },
    { layer: "primitives", autocomplete: "popover" },
  ];
}

/**
 * The tooltip: the popover's surface in a smaller box, revealed by hovering or
 * focusing the element it describes.
 *
 *   <button>Hover me</button>
 *   <tooltip>Tip text</tooltip>
 *
 * The trigger is the element immediately before the tooltip, matched with
 * `:has(+ tooltip)` rather than by tag so a tooltip can describe a button, a
 * link, or anything else without this component claiming that element. The
 * tooltip is a sibling of its trigger, not a child, so the trigger cannot be
 * its containing block — a positioned element only contains its descendants.
 * Instead the shared parent is made the containing block and shrink-wrapped
 * to the trigger, so the tip's `100%` and `50%` resolve against the trigger's
 * box and the tip tracks the element rather than the page. The tooltip itself
 * never takes pointer events — otherwise it would sit under the cursor and
 * flicker.
 */
function tooltipRule(mode: Mode): Rule {
  const tooltip = claim(mode, "tooltip");
  // The shared parent of a trigger and its tip: the element that has the
  // tip as a direct child. The tip is a sibling of its trigger, so the
  // trigger cannot be its containing block — a positioned element only
  // contains its descendants. The parent is made the containing block
  // and shrink-wrapped to the trigger.
  const parent = `*:has(> ${tooltip})`;
  return [
    /^tooltip$/,
    function* (_m, ctx) {
      const t = popoverTokens(ctx);

      yield {
        [ctx.symbols.selector]: () => tooltip,
        display: "block",
        position: "absolute",
        ...(t.spacing1 !== undefined
          ? { "inset-block-start": `calc(100% + ${t.spacing1})` }
          : {}),
        "inset-inline-start": "50%",
        translate: "-50% 0",
        ...(t.zDropdown !== undefined ? { "z-index": t.zDropdown } : {}),
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { border: `${t.borderWidth} solid ${t.border}` }
          : {}),
        ...(t.radiusSm !== undefined ? { "border-radius": t.radiusSm } : {}),
        ...(t.shadowSm !== undefined ? { "box-shadow": t.shadowSm } : {}),
        ...(t.spacing1 !== undefined
          ? {
            "padding-block-start": t.spacing1,
            "padding-block-end": t.spacing1,
          }
          : {}),
        ...(t.spacing2 !== undefined
          ? {
            "padding-inline-start": t.spacing2,
            "padding-inline-end": t.spacing2,
          }
          : {}),
        ...(t.sizeXs !== undefined ? { "font-size": t.sizeXs } : {}),
        "white-space": "nowrap",
        "pointer-events": "none",
        opacity: "0",
        visibility: "hidden",
        "transition-property": "opacity, visibility",
        ...(t.duration !== undefined
          ? { "transition-duration": t.duration }
          : {}),
        ...(t.easing !== undefined
          ? { "transition-timing-function": t.easing }
          : {}),
      };

      // The shared parent is the tip's containing block, shrink-wrapped to
      // the trigger so the tip's `100%` and `50%` resolve against the
      // trigger's box. Without this the tip resolves against the initial
      // containing block (the viewport) and lands off-screen.
      yield {
        [ctx.symbols.selector]: () => parent,
        position: "relative",
        "width": "fit-content",
      };

      // Shown on the states that mean "this has a description you want". The
      // tip is the trigger's next sibling, so `+` is exact and cannot reveal
      // a tooltip belonging to something else.
      yield {
        [ctx.symbols.selector]: () =>
          `*:is(:hover, :focus-visible):has(+ ${tooltip}) + ${tooltip}`,
        opacity: "1",
        visibility: "visible",
      };
    },
    { layer: "primitives", autocomplete: "tooltip" },
  ];
}
