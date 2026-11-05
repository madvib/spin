import type { Rule } from "@unocss/core";
import { proseTokens, spacing, styleType } from "./shared.ts";
import { paintedTag } from "./scope.ts";

/**
 * The code family: `code`, `samp`, `pre`.
 *
 * Three tags that all say "this is machine text" and all read the same way — a
 * monospace face at a size that sits correctly beside prose, on a surface that
 * separates it from the paragraph. Separate from `prose.ts` because none of
 * them shares a state with a heading or a list; what they share is typography,
 * and that is what the code style is for.
 *
 * Each reads the code style outright, and a theme moves its machine text by
 * moving the style.
 */

/** Inline code: a chip that reads as code without leaving the line box. */
function codeRule(): Rule {
  return [
    /^code$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const s = styleType(ctx, "code");
      const family = s.family;
      const size = s.size;
      const weight = s.weight;
      const tracking = s.tracking;
      const leading = s.leading;
      yield {
        [ctx.symbols.selector]: () => "code",
        ...(family !== undefined ? { "font-family": family } : {}),
        ...(size !== undefined ? { "font-size": size } : {}),
        ...(weight !== undefined ? { "font-weight": weight } : {}),
        ...(tracking !== undefined ? { "letter-spacing": tracking } : {}),
        ...(leading !== undefined ? { "line-height": leading } : {}),
        ...(t.spacing1 !== undefined
          ? { padding: `calc(${t.spacing1} / 2) ${t.spacing1}` }
          : {}),
        ...(t.radiusSm !== undefined ? { "border-radius": t.radiusSm } : {}),
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
      };
    },
    { layer: "primitives", autocomplete: "code" },
  ];
}

/** Program output: the mono face, no chip — it is a run of text, not a token. */
function sampRule(): Rule {
  return [
    /^samp$/,
    function* (_m, ctx) {
      const family = styleType(ctx, "code").family;
      const s = styleType(ctx, "code");
      const size = s.size;
      yield {
        [ctx.symbols.selector]: () => "samp",
        ...(family !== undefined ? { "font-family": family } : {}),
        ...(size !== undefined ? { "font-size": size } : {}),
      };
    },
    { layer: "primitives", autocomplete: "samp" },
  ];
}

/**
 * A code block.
 *
 * Two treatments, and they belong to different owners.
 *
 * The block's TYPE — the mono face and the spacing it sits in — is
 * typography, and typography is the theme's everywhere: a code block in a
 * panel reads like a code block in a document.
 *
 * The block's CHROME — the padding, the raised surface, the corner — is the
 * document's furniture, and the inline chip is undone inside it: a block is
 * not a stack of chips.
 */
function preRule(): Rule {
  const chrome = paintedTag("prose", "descendant", "pre");
  return [
    /^pre$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      const family = styleType(ctx, "code").family;
      yield {
        [ctx.symbols.selector]: () => "pre",
        // The mono face is what makes a block code; the SIZE is the author's.
        // A pinned font-size here beat every text utility on the same element
        // at equal specificity, so a consumer could not size their own code
        // block.
        ...(family !== undefined ? { "font-family": family } : {}),
        ...spacing(t),
      };
      yield {
        [ctx.symbols.selector]: () => chrome,
        ...(t.spacing2 !== undefined && t.spacing4 !== undefined
          ? { padding: `${t.spacing2} ${t.spacing4}` }
          : {}),
        ...(t.radiusMd !== undefined ? { "border-radius": t.radiusMd } : {}),
        // A block is an object, so it takes the raised surface — the page
        // colour leaves a code block reading as more prose, and the two are
        // different things.
        ...(t.raised !== undefined ? { "background-color": t.raised } : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
        "line-height": "1.5",
        "overflow-x": "auto",
      };
      // A block is not a stack of inline chips.
      yield {
        [ctx.symbols.selector]: () => `${chrome} :is(code)`,
        padding: "0",
        "background-color": "transparent",
      };
    },
    { layer: "primitives", autocomplete: "pre" },
  ];
}

export function codeRules(): Rule[] {
  return [codeRule(), sampRule(), preRule()];
}
