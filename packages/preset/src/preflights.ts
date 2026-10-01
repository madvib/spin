/**
 * Assembling the document, lowest layer first.
 *
 * Every CSS layer below the utilities enters here as a provider carrying a
 * numeric order. The order is the whole mechanism: utilities resolve at 0 and
 * everything here loses to them, so a component is a default and a utility is
 * a decision. That is why there is no dependency graph between layers — the
 * cascade already arbitrates, and a component never needs to know what will
 * eventually override it.
 *
 * Reset and the reduced-motion clamp live here rather than in
 * `@spin/theme/base` because neither spends a token: no theme can change
 * them, so a theme module carrying them would claim a decision it does not get
 * to make. They are the stage every document needs before anything else means
 * anything.
 */

import { generateThemeCss } from "@spin/theme";
import type { TokenTree } from "@spin/theme";
import { basePreflights } from "@spin/theme/base";
import type { PreflightProvider } from "@spin/theme/base";
import { animationPreflights } from "@spin/animation";
import { generatePrimitivesCss } from "@spin/primitives";
import type { ThemeDocument } from "./index.ts";

const RESET_CSS =
  "*, ::before, ::after { box-sizing: border-box; border: 0 solid; }";

/**
 * The motion floor, applied once rather than copied into every component that
 * animates. A component that needs to do more than stop — a busy spinner that
 * should read as busy without moving — overrides it locally, where the
 * override sits next to what it overrides.
 */
const REDUCED_MOTION_CSS = [
  "@media (prefers-reduced-motion: reduce) {",
  "  *, ::before, ::after {",
  "    animation-duration: 0.01ms !important;",
  "    animation-iteration-count: 1 !important;",
  "    transition-duration: 0.01ms !important;",
  "    scroll-behavior: auto !important;",
  "  }",
  "}",
].join("\n");

/** Utilities resolve at 0. Every layer below is overridable by a utility. */
export const LAYER = {
  reset: -100,
  theme: -90,
  components: -50,
} as const;

export interface PreflightOptions {
  /**
   * Primitive components to include, by name. Omitted means all of them.
   * `false` ships theme variables and utilities only.
   */
  primitives?: string[] | boolean;
}

export interface PreflightInput {
  /** Parsed token trees, keyed by theme name. */
  trees: Record<string, TokenTree>;
  /**
   * The same themes as raw documents. Extensions live here — `parseTokens`
   * keeps tokens and drops `$extensions`, but font declarations are theme
   * content, so the assembler needs both views of one document.
   */
  documents: Record<string, ThemeDocument>;
}

/** A provider plus the UnoCSS layer it emits into. */
interface Assembled extends PreflightProvider {
  layer: string;
}

/**
 * Collect every provider, sort by order, drop the ones that emit nothing.
 *
 * Sorting is numeric because UnoCSS re-sorts preflights it does not
 * recognise, so the order we write is not the order that ships. `name` breaks
 * ties so the result is stable across runs.
 */
function assemble(
  input: PreflightInput,
  opts: PreflightOptions,
): Assembled[] {
  // `undefined` means every primitive; an empty list means none.
  const enabled: string[] | undefined = Array.isArray(opts.primitives)
    ? opts.primitives
    : opts.primitives === false
    ? []
    : undefined;

  const base = basePreflights(input.documents.light ?? {}).map((provider) => ({
    ...provider,
    layer: "theme",
  }));

  const providers: Assembled[] = [
    {
      name: "reset",
      layer: "reset",
      order: LAYER.reset,
      getCSS: () => RESET_CSS,
    },
    {
      name: "theme/motion-policy",
      layer: "theme",
      order: LAYER.theme,
      getCSS: () => REDUCED_MOTION_CSS,
    },
    {
      name: "theme/variables",
      layer: "theme",
      order: LAYER.theme,
      getCSS: () => generateThemeCss(input.trees),
    },
    ...base,
    // Motion is unconditional: a component that names a keyframe must never
    // ship without its definition, and keyframes cannot be shaken anyway.
    ...animationPreflights().map((provider) => ({
      ...provider,
      layer: "primitives",
    })),
    ...(enabled === undefined || enabled.length > 0
      ? [{
        name: "primitives",
        layer: "primitives",
        order: LAYER.components,
        getCSS: () => generatePrimitivesCss(enabled),
      }]
      : []),
  ];

  return providers
    .filter((provider) => provider.getCSS().trim().length > 0)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function buildPreflights(
  input: PreflightInput,
  opts: PreflightOptions = {},
) {
  return assemble(input, opts).map((provider) => ({
    layer: provider.layer,
    getCSS: () => provider.getCSS().trim(),
  }));
}
