import type { Rule } from "@unocss/core";
import { token } from "../../utils/lookup.ts";

/**
 * Accessibility and operability — the two things CSS can say about an
 * element's relationship to a person using it.
 *
 * Neither is a component: neither is a tag anyone writes deliberately, and
 * both are states of an element that already exists. They live here together
 * because they share one claim — *this element is operable, or it is not, and
 * the pointer should say so* — and splitting them across two files would hide
 * that.
 *
 * The cursor is the whole idea. A control that a pointer cannot use looks
 * exactly like one it can until you try it, and the cursor is the only signal
 * that costs nothing and is always visible. `[aria-controls]` says the element
 * opens something; `[disabled]` and `[aria-disabled]` say it cannot be used at
 * all.
 *
 * `visually-hidden` is the other half. It has to collapse to a single pixel to
 * stay in the accessibility tree — a screen reader still announces it, a
 * sighted user cannot see it — which makes `1px` load-bearing rather than
 * arbitrary. A theme may not restate it.
 */
export function a11yRules(roots: readonly string[]): Rule[] {
  return [...cursorRules(roots), ...hiddenRules(roots)];
}

/**
 * Cursor follows operability.
 *
 * `aria-disabled` is the interesting half: an element that is disabled for
 * assistive technology but still needs to be focusable — a submit button in a
 * form whose validity has not been checked yet, for instance. Making it
 * `pointer-events: none` would remove it from the tab order too, which is the
 * opposite of what the attribute is for.
 */
function cursorRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("a11y")) return [];
  return [
    [
      /^cursor$/,
      function* (_m, ctx) {
        yield {
          [ctx.symbols.selector]: () => "[aria-controls]",
          cursor: "pointer",
        };
        yield {
          [ctx.symbols.selector]: () =>
            ':is([disabled], [aria-disabled="true"], fieldset[disabled] *)',
          cursor: "not-allowed",
        };
      },
      { layer: "primitives", autocomplete: "cursor" },
    ],
  ];
}

/**
 * Hidden from sight, present in the tree.
 *
 * Two selectors share the recipe because they mean the same thing: an element
 * that opts back into the accessibility tree despite `hidden`, and the class
 * for when there is no such attribute to lean on.
 *
 * The focus escape matters. An element hidden with `hidden` is not reachable
 * by keyboard, so an author who overrides that to keep it announced has also
 * overridden its un-hiding for sighted keyboard users — unless the focus state
 * puts it back. Without this rule the element is in the tree and invisible to
 * everyone, which is worse than either outcome alone.
 */
function hiddenRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("a11y")) return [];
  return [
    [
      /^visually-hidden$/,
      function* (_m, ctx) {
        const duration = token(ctx, "motion.duration.fast");
        yield {
          [ctx.symbols.selector]: () =>
            ':is([aria-hidden="false"][hidden], .visually-hidden)',
          position: "absolute",
          overflow: "hidden",
          "white-space": "nowrap",
          // The clip is what removes it from view without removing it from
          // the tree; `display: none` and `visibility: hidden` both do.
          "clip-path": "inset(50%)",
          width: "1px",
          height: "1px",
          ...(duration !== undefined ? { transition: "none" } : {}),
        };
        yield {
          [ctx.symbols.selector]: () =>
            ':is([aria-hidden="false"][hidden], .visually-hidden):focus',
          position: "static",
          overflow: "visible",
          "clip-path": "none",
          width: "auto",
          height: "auto",
        };
      },
      { layer: "primitives", autocomplete: "visually-hidden" },
    ],
  ];
}
