import type { Rule } from "@unocss/core";
import { claim, proseTokens, type Mode } from "./shared.ts";

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
        ...(t.borderWidth !== undefined
          ? { "border-block-end-width": `calc(${t.borderWidth} * 2)` }
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
