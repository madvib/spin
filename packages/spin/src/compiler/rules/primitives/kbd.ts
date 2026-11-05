import type { Rule } from "@unocss/core";
import { proseTokens, styleType } from "./shared.ts";

/** Keyboard input: a keycap for a key on the keyboard. */
function kbdRule(): Rule {
  return [
    /^kbd$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const fam = styleType(ctx, "code").family;
      const size = styleType(ctx, "caption").size;
      yield {
        [ctx.symbols.selector]: () => "kbd",
        ...(fam !== undefined ? { "font-family": fam } : {}),
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(t.spacing1 !== undefined
          ? { padding: `calc(${t.spacing1} / 4) ${t.spacing1}` }
          : {}),
        // A keycap's edge is a hairline, never the theme's control stroke: the
        // cap is a micro-element, and a 3px border plus padding doubles its
        // height until it stretches whatever control carries it.
        ...(t.border !== undefined ? { border: `1px solid ${t.border}` } : {}),
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

export function kbdRules(roots: readonly string[]): Rule[] {
  if (!roots.includes("kbd")) return [];
  return [kbdRule()];
}
