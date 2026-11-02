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
        // A keycap's edge is a hairline, never the theme's control stroke: the
        // cap is a micro-element, and a 3px border plus padding doubles its
        // height until it stretches whatever control carries it. The shadow
        // keeps the theme's step as the bottom stamp — the keycap read.
        ...(t.border !== undefined ? { border: `1px solid ${t.border}` } : {}),
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
