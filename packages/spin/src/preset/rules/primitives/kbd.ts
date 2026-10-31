import type { Rule } from "@unocss/core";
import { claim, type Mode, proseTokens } from "./shared.ts";

/** Keyboard input: a keycap for a key on the keyboard. */
function kbdRule(mode: Mode): Rule {
  return [
    /^kbd$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "kbd"),
        ...(t.mono !== undefined ? { "font-family": t.mono } : {}),
        ...(t.sizeXs !== undefined ? { "font-size": t.sizeXs } : {}),
        ...(t.spacing1 !== undefined
          ? { padding: `calc(${t.spacing1} / 2) ${t.spacing1}` }
          : {}),
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { border: `${t.borderWidth} solid ${t.border}` }
          : {}),
        // The keycap's bottom step is a shadow, not a thicker border: a
        // doubled block-end border eats the face on chunky-border themes
        // until the cap reads as a solid brick.
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { "box-shadow": `0 ${t.borderWidth} 0 0 ${t.border}` }
          : {}),
        ...(t.radiusSm !== undefined ? { "border-radius": t.radiusSm } : {}),
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
        "white-space": "nowrap",
      };
    },
    { layer: "primitives", autocomplete: "kbd" },
  ];
}

export function kbdRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("kbd")) return [];
  return [kbdRule(mode)];
}
