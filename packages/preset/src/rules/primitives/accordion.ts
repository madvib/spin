import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Accordion — `accordion-root`, `accordion-item`, `accordion-trigger`,
 * `accordion-content`.
 *
 * A disclosure repeated: each item is a label plus a region, exactly one
 * open unless `multiple`. Unlike `<details>`, the state lives in a machine
 * rather than the platform, so the open marker is `data-state` rather than
 * the `open` attribute — but everything else follows the disclosure: the
 * trigger is a row with a pointer, the indicator is drawn geometry that
 * turns with the state, and the content is inset from the label.
 *
 * The trigger is a custom element, not a `<button>`, because a tree row is
 * not a call to action. It gets pointer, focus ring and hover from the
 * control family without the button's background.
 */
export function accordionRules(
  roots: readonly string[],
  mode: Mode,
): Rule[] {
  if (!roots.includes("accordion")) return [];
  const root = claim(mode, "accordion-root");
  const item = claim(mode, "accordion-item");
  const trigger = claim(mode, "accordion-trigger");
  const content = claim(mode, "accordion-content");
  return [
    rootRule(root),
    itemRule(item),
    triggerRule(trigger),
    contentRule(content),
    indicatorRule(trigger),
  ];
}

interface Tokens {
  readonly spacing2: string | undefined;
  readonly spacing3: string | undefined;
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
    spacing2: t?.spacing?.["2"],
    spacing3: t?.spacing?.["4"],
    radius: t?.radius?.["md"],
    text: t?.colors?.["text"],
    muted: t?.colors?.["text-muted"],
    raised: t?.colors?.["surface-raised"],
    border: t?.colors?.["border"],
    borderWidth: t?.borderWidth?.["DEFAULT"],
    duration: t?.duration?.["DEFAULT"],
    easing: t?.easing?.["DEFAULT"],
  };
}

function rootRule(root: string): Rule {
  return [
    /^accordion-root$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => root,
        display: "block",
        width: "100%",
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { border: `${t.borderWidth} solid ${t.border}` }
          : {}),
        ...(t.radius !== undefined ? { "border-radius": t.radius } : {}),
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
      };
    },
    { layer: "primitives", autocomplete: "accordion" },
  ];
}

function itemRule(item: string): Rule {
  return [
    /^accordion-item$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => item,
        display: "block",
        "overflow-anchor": "none",
      };
      yield {
        [ctx.symbols.selector]: () => `${item} + ${item}`,
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { "border-top": `${t.borderWidth} solid ${t.border}` }
          : {}),
      };
    },
    { layer: "primitives" },
  ];
}

function triggerRule(trigger: string): Rule {
  return [
    /^accordion-trigger$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => trigger,
        display: "flex",
        "align-items": "center",
        ...(t.spacing3 !== undefined ? { gap: t.spacing3 } : {}),
        cursor: "pointer",
        width: "100%",
        "text-align": "start",
        "font-weight": "600",
        ...(t.spacing2 !== undefined && t.spacing3 !== undefined
          ? {
            padding: `${t.spacing2} ${t.spacing3}`,
          }
          : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
        ...(t.radius !== undefined ? { "border-radius": t.radius } : {}),
        ...(t.duration !== undefined ? { "transition-duration": t.duration } : {}),
        ...(t.easing !== undefined
          ? { "transition-timing-function": t.easing }
          : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${trigger}:hover`,
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${trigger}:focus-visible`,
        "outline-offset": "2px",
      };
      yield {
        [ctx.symbols.selector]: () => `${trigger}[data-disabled]`,
        cursor: "not-allowed",
        opacity: "0.5",
      };
    },
    { layer: "primitives" },
  ];
}

function contentRule(content: string): Rule {
  return [
    /^accordion-content$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => content,
        display: "block",
        overflow: "hidden",
        ...(t.spacing2 !== undefined && t.spacing3 !== undefined
          ? {
            "padding-block-end": `calc(${t.spacing2} * 2)`,
            "padding-inline-start": t.spacing3,
            "padding-inline-end": t.spacing3,
          }
          : {}),
        ...(t.muted !== undefined ? { color: t.muted } : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${content}[hidden]`,
        display: "none",
      };
    },
    { layer: "primitives" },
  ];
}

function indicatorRule(trigger: string): Rule {
  return [
    /^accordion-trigger$/,
    function* (_m, ctx) {
      const t = tokens(ctx);
      yield {
        [ctx.symbols.selector]: () => `${trigger} > span:first-child`,
        position: "relative",
        display: "inline-block",
        width: "1em",
        height: "1em",
        "flex-shrink": "0",
        ...(t.muted !== undefined ? { color: t.muted } : {}),
      };
      yield {
        [ctx.symbols.selector]: () => `${trigger} > span:first-child::before`,
        content: '""',
        position: "absolute",
        inset: "0",
        margin: "auto",
        width: "6px",
        height: "6px",
        "border-right": "1.5px solid currentColor",
        "border-bottom": "1.5px solid currentColor",
        transform: "translate(-1px, -1px) rotate(-45deg)",
        ...(t.duration !== undefined
          ? { transition: `transform ${t.duration}` }
          : {}),
      };
      yield {
        [ctx.symbols.selector]: () =>
          `${trigger}[data-state="open"] > span:first-child::before`,
        transform: "translate(-1px, -1px) rotate(45deg)",
      };
    },
    { layer: "primitives" },
  ];
}
