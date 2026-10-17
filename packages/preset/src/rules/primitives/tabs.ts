import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Tabs — `<tabs>` with radio inputs, and no JavaScript at all.
 *
 * The platform already has a single-choice control: a group of radios sharing
 * a `name` is exclusive, keyboard-operable, and announced as a radio group by
 * every screen reader. A tab strip is exactly that control with the labels
 * drawn as tabs, so the behaviour is the browser's and this file is only the
 * drawing.
 *
 * How it holds together without script:
 *
 *   `<label>` wraps its radio, so the label is the click target and the radio
 *   needs no `for`/`id` pair to be reachable.
 *
 *   `label:has(input:checked)` is the tab's selected appearance. `:has()` is
 *   what reaches up from the radio the reader clicked to the label drawn as a
 *   tab; `:checked ~` is what reaches forward from that label to its panel.
 *
 *   `label:has(input:checked) ~ section` shows the panel. The `~` is safe
 *   because each label and its panel share a wrapper, so the general sibling
 *   combinator can only reach the panel that belongs to the checked label —
 *   it never sees a panel in another tab.
 *
 *   The wrapper is `display: contents`, so the labels land in the container's
 *   flex row and the panels land beneath it, while the DOM keeps the pairing
 *   the selectors need.
 *
 * The radios are hidden with the visually-hidden recipe rather than
 * `display: none`, so they stay focusable and a keyboard user can still change
 * tabs. The focus ring is drawn on the label, because the label is what the
 * reader sees.
 *
 * `tabs-vertical` is a structural variant: it changes where the rail and the
 * panels sit, and moves the selected edge with them. No colour changes — the
 * same tones, the same surfaces, laid out down the page instead of across it.
 */
export function tabsRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("tabs")) return [];
  return [tabsBase(mode), tabsVertical(mode)];
}

function tabsTokens(ctx: Parameters<typeof themeOf>[0]) {
  const t = themeOf(ctx);
  return {
    spacing0: t?.spacing["0"],
    spacing1: t?.spacing["1"],
    spacing2: t?.spacing["2"],
    spacing4: t?.spacing["4"],
    text: t?.colors["text"],
    muted: t?.colors["text-muted"],
    primary: t?.colors["primary"],
    focusRing: t?.colors["focus-ring"],
    focusWidth: t?.focusWidth?.["width"],
    focusOffset: t?.focusOffset?.["offset"],
    borderWidth: t?.borderWidth?.["width"],
    weightMedium: t?.fontWeight?.["medium"],
    weightSemibold: t?.fontWeight?.["semibold"],
    duration: t?.motionDuration?.["fast"],
    easing: t?.motionEasing?.["standard"],
  };
}

/**
 * The horizontal tabset: the rail, the hidden radios, and the panels.
 *
 * Every state is a yield of one generator, separated by the selector each
 * yield carries. The token is `tabs` — the tag the document writes — so the
 * whole component shakes when no `<tabs>` is on the page.
 */
function tabsBase(mode: Mode): Rule {
  const tabs = claim(mode, "tabs");
  const label = `${tabs} label`;
  const radio = `${tabs} input[type="radio"]`;
  // The panel's own claim, without the container prefix: after a sibling or
  // child combinator the right-hand side must be the element itself, not a
  // descendant of `tabs`, or the selector asks for a `tabs` that is a sibling
  // of the label — which does not exist.
  const panelTag = claim(mode, "section");
  const panel = `${tabs} ${panelTag}`;
  return [
    /^tabs$/,
    function* (_m, ctx) {
      const t = tabsTokens(ctx);

      // The container. Labels are the rail and wrap onto their own line; each
      // panel asks for the full width, so it lands on the line beneath.
      yield {
        [ctx.symbols.selector]: () => tabs,
        display: "flex",
        "flex-wrap": "wrap",
        ...(t.spacing1 !== undefined ? { "column-gap": t.spacing1 } : {}),
      };

      // The per-tab wrapper. It carries no box of its own: its children
      // (the label and the panel) participate in the container's flex layout
      // directly, which is what lets the labels form one row while the
      // selectors still see the label and panel as siblings.
      yield {
        [ctx.symbols.selector]: () => `${tabs} > div`,
        display: "contents",
      };

      // The radio is the control, the label is the drawing. Hidden with the
      // visually-hidden recipe rather than `display: none` so it keeps focus
      // and the arrow keys keep working.
      yield {
        [ctx.symbols.selector]: () => radio,
        position: "absolute",
        "inline-size": "1px",
        "block-size": "1px",
        ...(t.spacing0 !== undefined ? { margin: t.spacing0 } : {}),
        padding: "0",
        overflow: "hidden",
        "clip-path": "inset(50%)",
        "white-space": "nowrap",
        appearance: "none",
      };

      // The tab. A bottom edge is reserved in the transparent state so the
      // selected edge does not change the label's height when it appears.
      yield {
        [ctx.symbols.selector]: () => label,
        position: "relative",
        display: "inline-flex",
        "align-items": "center",
        ...(t.spacing1 !== undefined ? { gap: t.spacing1 } : {}),
        ...(t.spacing2 !== undefined
          ? {
            "padding-block-start": t.spacing2,
            "padding-block-end": t.spacing2,
          }
          : {}),
        ...(t.spacing4 !== undefined
          ? {
            "padding-inline-start": t.spacing4,
            "padding-inline-end": t.spacing4,
          }
          : {}),
        cursor: "pointer",
        "user-select": "none",
        ...(t.muted !== undefined ? { color: t.muted } : {}),
        ...(t.weightMedium !== undefined
          ? { "font-weight": t.weightMedium }
          : {}),
        ...(t.borderWidth !== undefined
          ? { "border-block-end": `${t.borderWidth} solid transparent` }
          : {}),
        ...(t.duration !== undefined
          ? {
            "transition-property": "color, border-color",
            "transition-duration": t.duration,
          }
          : {}),
        ...(t.easing !== undefined
          ? { "transition-timing-function": t.easing }
          : {}),
      };

      // Hover raises the label's ink without claiming the tab is selected.
      yield {
        [ctx.symbols.selector]: () => `${label}:hover`,
        ...(t.text !== undefined ? { color: t.text } : {}),
      };

      // The selected tab. `:has()` is the reach from the radio to the label;
      // the border colour is the indicator, so it needs no extra element.
      yield {
        [ctx.symbols.selector]: () => `${label}:has(input:checked)`,
        ...(t.text !== undefined ? { color: t.text } : {}),
        ...(t.weightSemibold !== undefined
          ? { "font-weight": t.weightSemibold }
          : {}),
        ...(t.primary !== undefined
          ? { "border-block-end-color": t.primary }
          : {}),
      };

      // Focus belongs to the label, because the label is the control the
      // reader sees. The hidden radio is focusable, so `:focus-visible` on it
      // is the signal that draws the ring around the label.
      yield {
        [ctx.symbols.selector]: () => `${label}:has(input:focus-visible)`,
        ...(t.focusWidth !== undefined && t.focusRing !== undefined
          ? { outline: `${t.focusWidth} solid ${t.focusRing}` }
          : {}),
        ...(t.focusOffset !== undefined
          ? { "outline-offset": t.focusOffset }
          : {}),
      };

      // A disabled tab is not a tab you can be on. It keeps whatever state it
      // has — one that is selected still says so — but it sits at half
      // presence and the cursor says why, the same language a disabled
      // button speaks.
      yield {
        [ctx.symbols.selector]: () => `${label}:has(input:disabled)`,
        opacity: themeOf(ctx)?.opacity?.["50"] ?? 0.55,
        cursor: "not-allowed",
      };

      // The label, which is the rail.
      yield {
        [ctx.symbols.selector]: () => label,
        order: "1",
      };

      // The panel is hidden until its tab is selected.
      yield {
        [ctx.symbols.selector]: () => panel,
        display: "none",
        // Every panel after every label. `flex-basis: 100%` alone only forces a
        // break when the item overflows the line, so the first panel can share
        // line one with the first label and the rail breaks. Ordering the two
        // kinds removes the dependence on widths entirely.
        order: "2",
        "flex-basis": "100%",
        ...(t.spacing4 !== undefined
          ? { "padding-block-start": t.spacing4 }
          : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
      };

      // The panel of the selected tab. `~` reaches it because the label and
      // its panel are siblings inside the wrapper — never a panel from
      // another tab.
      yield {
        [ctx.symbols.selector]: () =>
          `${label}:has(input:checked) ~ ${panelTag}`,
        display: "block",
      };

      // A tabset with nothing selected still has content. The first panel is
      // shown rather than leaving an empty box, and `:has()` on the container
      // is what reads that no radio is checked.
      yield {
        [ctx.symbols.selector]: () =>
          `${tabs}:not(:has(input:checked)) > div:first-of-type > ${panelTag}`,
        display: "block",
      };
    },
    { layer: "primitives", autocomplete: "tabs" },
  ];
}

/**
 * The vertical tabset: the rail stacks down the inline-start edge and the
 * panels sit beside it.
 *
 * A separate rule because `tabs-vertical` is a class the document writes, and
 * a token of its own; keying it separately is what lets the variant shake on
 * its own. It changes layout only — the selected edge moves from the bottom of
 * the label to its inline-end, which is where the rail's edge now is.
 */
function tabsVertical(mode: Mode): Rule {
  const tabs = claim(mode, "tabs");
  const vertical = `${tabs}.tabs-vertical`;
  const label = `${vertical} label`;
  const panel = `${vertical} section`;
  return [
    /^tabs-vertical$/,
    function* (_m, ctx) {
      const t = tabsTokens(ctx);

      yield {
        [ctx.symbols.selector]: () => vertical,
        display: "grid",
        "grid-template-columns": "max-content 1fr",
        "align-items": "start",
        ...(t.spacing1 !== undefined ? { "column-gap": t.spacing1 } : {}),
      };

      // The label owns the first column. The reserved edge moves to the
      // inline-end, so the selected indicator runs down the rail rather than
      // under each label.
      yield {
        [ctx.symbols.selector]: () => label,
        "grid-column": "1",
        "justify-content": "flex-start",
        ...(t.borderWidth !== undefined
          ? {
            "border-block-end": "none",
            "border-inline-end": `${t.borderWidth} solid transparent`,
          }
          : {}),
      };

      yield {
        [ctx.symbols.selector]: () => `${label}:has(input:checked)`,
        ...(t.primary !== undefined
          ? { "border-inline-end-color": t.primary }
          : {}),
      };

      // The panel sits in the second column and no longer needs the top pad
      // that separated it from a horizontal rail.
      yield {
        [ctx.symbols.selector]: () => panel,
        "grid-column": "2",
        "padding-block-start": "0",
        ...(t.spacing4 !== undefined
          ? { "padding-inline-start": t.spacing4 }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "tabs-vertical" },
  ];
}
