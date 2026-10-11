import type { Rule } from "@unocss/core";
import { claim, type Mode, proseTokens, rhythm } from "./shared.ts";

/**
 * The code family: `code`, `samp`, `pre`.
 *
 * Three tags that all say "this is machine text" and all read the same way — a
 * monospace face at a size that sits correctly beside prose, on a surface that
 * separates it from the paragraph. Separate from `prose.ts` because none of
 * them shares a state with a heading or a list; what they share is typography,
 * and that is what `proseTokens` is for.
 */

/** Inline code: a chip that reads as code without leaving the line box. */
function codeRule(mode: Mode): Rule {
  return [
    /^code$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "code"),
        ...(t.mono !== undefined ? { "font-family": t.mono } : {}),
        ...(t.sizeSm !== undefined ? { "font-size": t.sizeSm } : {}),
        ...(t.spacing1 !== undefined
          ? { padding: `calc(${t.spacing1} / 2) ${t.spacing1}` }
          : {}),
        ...(t.radiusSm !== undefined ? { "border-radius": t.radiusSm } : {}),
        ...(t.surface !== undefined ? { "background-color": t.surface } : {}),
        ...(t.text !== undefined ? { color: t.text } : {}),
      };
    },
    { layer: "primitives", autocomplete: "code" },
  ];
}

/** Program output: the mono face, no chip — it is a run of text, not a token. */
function sampRule(mode: Mode): Rule {
  return [
    /^samp$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => claim(mode, "samp"),
        ...(t.mono !== undefined ? { "font-family": t.mono } : {}),
        ...(t.sizeSm !== undefined ? { "font-size": t.sizeSm } : {}),
      };
    },
    { layer: "primitives", autocomplete: "samp" },
  ];
}

/** A code block. The inline chip is undone inside it. */
function preRule(mode: Mode): Rule {
  const pre = claim(mode, "pre");
  return [
    /^pre$/,
    function* (_m, ctx) {
      const t = proseTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => pre,
        // The mono face is what makes a block code; the SIZE is the author's.
        // A pinned font-size here beat every text utility on the same element
        // at equal specificity, so a consumer could not size their own code
        // block — the ladder exists so the app can spend it.
        ...(t.mono !== undefined ? { "font-family": t.mono } : {}),
        ...rhythm(t),
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
        [ctx.symbols.selector]: () => `${pre} ${claim(mode, "code")}`,
        padding: "0",
        "background-color": "transparent",
      };
    },
    { layer: "primitives", autocomplete: "pre" },
  ];
}

export function codeRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("prose")) return [];
  return [
    codeRule(mode),
    sampRule(mode),
    preRule(mode),
  ];
}
