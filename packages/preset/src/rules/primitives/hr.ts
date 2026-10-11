import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import { claim, type Mode, proseTokens } from "./shared.ts";

/**
 * Hr — a rule between content, drawn from the border tokens, not a heavy
 * default.
 *
 * Three opinions, all of them about where the rule sits rather than how heavy
 * it is:
 *
 * **The bare tag is the whole surface.** One `<hr>` between blocks, spaced by
 * the scale and drawn from the theme's border tokens. Thicken the borders and
 * the divider thickens with them, because the rule states no weight of its
 * own.
 *
 * **`divider-vertical` turns the rule on its side.** A separator between items
 * in a row is the same decision as one between blocks, so it is the same rule
 * with the logical axes swapped: zero inline size makes it a rule rather than
 * a block, the length comes from the spacing scale, and the line moves to the
 * inline edge — the edge the horizontal rule leaves bare. The block margin the
 * base spends above and below is spent beside it instead.
 *
 * **`divider-dashed` breaks the line.** The same rule, drawn dashed: a solid
 * line reads as a stop, a broken one reads as a continuation, which is what a
 * long list of sections or a run of metadata asks for. The weight is still the
 * theme's — the variant changes the style and nothing else.
 */
export function hrRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("hr")) return [];
  const base = claim(mode, "hr");
  return [hrRule(base), dividerVertical(base), dividerDashed(base)];
}

function hrRule(base: string): Rule {
  return [
    /^hr$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => base,
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

/** The vertical rule's length, and the room it keeps beside it. */
function dividerTokens(ctx: Parameters<typeof themeOf>[0]) {
  return {
    length: themeOf(ctx)?.spacing?.["8"],
    space: themeOf(ctx)?.spacing?.["4"],
    width: themeOf(ctx)?.borderWidth?.["width"],
    color: themeOf(ctx)?.colors?.["border"],
  };
}

/**
 * The rule on its side.
 *
 * Zero inline size and a border on the inline edge is the whole construction:
 * the base already proven it with `height: 0` and a border on the block-start
 * edge, and these are the same two declarations with the axes turned. The
 * base's `border: 0` is restated because a vertical rule carries the
 * horizontal one's line as well otherwise — the block-start border the base
 * drew is still on the element.
 */
function dividerVertical(base: string): Rule {
  return [
    /^divider-vertical$/,
    function* (_m, ctx) {
      const t = dividerTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => `${base}.divider-vertical`,
        ...(t.length !== undefined ? { "block-size": t.length } : {}),
        "inline-size": "0",
        "margin-block": "0",
        ...(t.space !== undefined ? { "margin-inline": t.space } : {}),
        border: "0",
        ...(t.width !== undefined && t.color !== undefined
          ? { "border-inline-start": `${t.width} solid ${t.color}` }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "divider-vertical" },
  ];
}

/**
 * The rule, broken.
 *
 * The variant restates the base's own line with the style swapped, so the
 * weight and the colour are still the theme's and the only thing that changed
 * is whether the line is continuous.
 */
function dividerDashed(base: string): Rule {
  return [
    /^divider-dashed$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => `${base}.divider-dashed`,
        ...(t.borderWidth !== undefined && t.border !== undefined
          ? { "border-block-start": `${t.borderWidth} dashed ${t.border}` }
          : {}),
      };
    },
    { layer: "primitives", autocomplete: "divider-dashed" },
  ];
}
