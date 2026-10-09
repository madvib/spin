import type { Rule } from "@unocss/core";
import { claim, proseTokens, type Mode } from "./shared.ts";

/** Hr — a rule between content, drawn from the border tokens, not a heavy default. */
export function hrRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("hr")) return [];
  return [hrRule(mode)];
}

function hrRule(mode: Mode): Rule {
  return [
    /^hr$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "hr"),
        height: "0",
        ...(t.spacing4 !== undefined ? { "margin-block": t.spacing4 } : {}),
        border: "0",
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { "border-block-start": `${t.borderWidth} solid ${t.border}` }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "hr" },
  ];
}
