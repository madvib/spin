import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode } from "./shared.ts";

/**
 * Mode switch — one button that cycles a theme's modes.
 *
 * The modes a theme serves are data (`modes` at the theme's root), and the
 * control reads what the host already decided: the button's `aria-label`
 * names the mode it will SWITCH TO — "use light mode", "use dark mode",
 * "follow the system" — as part of naming it for assistive tech. The state
 * is a native button and a pressed flag: `aria-pressed="true"` marks the
 * selection the author wires up, and `disabled` or `aria-disabled="true"`
 * marks a control with nothing to cycle.
 *
 * A theme that serves one mode (`neobrut` serves light, `console` serves
 * dark) has nothing to cycle, so the control must disable rather than let
 * it lie: an enabled switcher on a single-mode theme promises a second
 * rendering that does not exist.
 */
export function modeRules(
  roots: readonly string[],
  mode: Mode,
): Rule[] {
  if (!roots.includes("mode")) return [];
  return [modeBase(mode), modeDisabled(mode)];
}

function modeBase(mode: Mode): Rule {
  return [
    /^mode$/,
    function* (_m, ctx) {
      const t = themeOf(ctx);
      const icon = t?.icon?.["md"];
      const gap = t?.spacing?.["2"];
      yield {
        [ctx.symbols.selector]: () => `${claim(mode, "button")}.mode`,
        // The face is the theme's icon step, not the button's type: a glyph
        // reads as a glyph because it is bigger than the label beside it,
        // and the button's own `text-transform: uppercase` in the loud
        // starters would otherwise shout a mode name at the reader.
        "text-transform": "none",
        ...(icon !== undefined ? { "font-size": icon } : {}),
        ...(gap !== undefined ? { gap } : {}),
      };
    },
    { layer: "primitives", autocomplete: "mode" },
  ];
}

function modeDisabled(mode: Mode): Rule {
  return [
    /^mode$/,
    function* (_m, ctx) {
      const t = themeOf(ctx);
      yield {
        [ctx.symbols.selector]: () =>
          `${claim(mode, "button")}.mode:disabled, ${
            claim(mode, "button")
          }.mode[aria-disabled="true"]`,
        // A disabled switcher is a statement, not a control: the theme
        // serves one mode, so there is nothing to cycle. Opacity says
        // inert, the a11y layer's cursor says unusable, and the element
        // stays in the tree for a reader who tabs to it and wants to know
        // why it does nothing.
        opacity: t?.opacity?.["40"] ?? 0.4,
      };
    },
    { layer: "primitives", autocomplete: "mode" },
  ];
}
