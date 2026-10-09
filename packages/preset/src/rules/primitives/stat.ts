import type { Rule } from "@unocss/core";
import { themeOf } from "../../utils/lookup.ts";
import type { Mode } from "./shared.ts";

/** Stat — a labelled number, sized and coloured by the type ladder. */
export function statRules(roots: readonly string[], mode: Mode): Rule[] {
  if (!roots.includes("stat")) return [];
  return [statContainer(), statTitle(), statValue(), statDesc()];
}

/** The theme values stat spends, resolved once per rule. */
type Tokens = {
  readonly spacing2: string | undefined;
  readonly sizeXs: string | undefined;
  readonly sizeSm: string | undefined;
  readonly size2xl: string | undefined;
  readonly weightSemibold: string | undefined;
  readonly text: string | undefined;
  readonly muted: string | undefined;
  readonly trackingWide: string | undefined;
};

function statTokens(ctx: Parameters<typeof themeOf>[0]): Tokens {
  const t = themeOf(ctx);
  return {
    spacing2: t?.spacing["2"],
    sizeXs: t?.fontSize?.["xs"],
    sizeSm: t?.fontSize?.["sm"],
    size2xl: t?.fontSize?.["2xl"],
    weightSemibold: t?.fontWeight?.["semibold"],
    text: t?.colors["text"],
    muted: t?.colors["text-muted"],
    trackingWide: t?.letterSpacing?.["wide"],
  };
}

/** The container: a flex column with a gap between the parts. */
function statContainer(): Rule {
  return [
    /^stat$/,
    function* (_m, ctx) {
      const { spacing2 } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat",
        display: "flex",
        "flex-direction": "column",
        ...(spacing2 !== undefined ? { gap: spacing2 } : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat" },
  ];
}

/** The label above the number: small, muted, uppercase, tracked open. */
function statTitle(): Rule {
  return [
    /^stat-title$/,
    function* (_m, ctx) {
      const { sizeXs, muted, weightSemibold, trackingWide } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat-title",
        ...(sizeXs !== undefined ? { "font-size": sizeXs } : {}),
        ...(muted !== undefined ? { color: muted } : {}),
        ...(weightSemibold !== undefined ? { "font-weight": weightSemibold } : {}),
        "text-transform": "uppercase",
        ...(trackingWide !== undefined ? { "letter-spacing": trackingWide } : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat-title" },
  ];
}

/** The number itself: the largest type stat carries. */
function statValue(): Rule {
  return [
    /^stat-value$/,
    function* (_m, ctx) {
      const { size2xl, weightSemibold, text } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat-value",
        ...(size2xl !== undefined ? { "font-size": size2xl } : {}),
        ...(weightSemibold !== undefined ? { "font-weight": weightSemibold } : {}),
        ...(text !== undefined ? { color: text } : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat-value" },
  ];
}

/** The context under the number, in the muted colour. */
function statDesc(): Rule {
  return [
    /^stat-desc$/,
    function* (_m, ctx) {
      const { sizeSm, muted } = statTokens(ctx);
      yield {
        [ctx.symbols.selector]: () => ".stat-desc",
        ...(sizeSm !== undefined ? { "font-size": sizeSm } : {}),
        ...(muted !== undefined ? { color: muted } : {}),
      };
    },
    { layer: "primitives", autocomplete: "stat-desc" },
  ];
}
