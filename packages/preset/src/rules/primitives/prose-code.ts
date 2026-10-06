import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import {
  claim,
  proseTokens,
  rhythm,
  type Mode,
  type Tokens,
} from "./shared.ts";

/**
 * The code family: `code`, `kbd`, `samp`, `pre`.
 *
 * Four tags that all say "this is machine text" and all read the same way — a
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

/** Keyboard input: a keycap, raised and with a real bottom edge. */
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
        ...(t.mono !== undefined ? { "font-family": t.mono } : {}),
        ...(t.sizeSm !== undefined ? { "font-size": t.sizeSm } : {}),
        ...rhythm(t),
        ...(t.spacing2 !== undefined && t.spacing4 !== undefined
          ? { padding: `${t.spacing2} ${t.spacing4}` }
          : {}),
        ...(t.radiusMd !== undefined ? { "border-radius": t.radiusMd } : {}),
        ...(t.surface !== undefined ? { "background-color": t.surface } : {}),
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
    kbdRule(mode),
    sampRule(mode),
    preRule(mode),
  ];
}
