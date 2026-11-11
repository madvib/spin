/**
 * Engine answer types + `fallbackAnswers` re-exports.
 *
 * The shapes live preset-side (`@spinjs/preset`), beside the code that
 * fills them — the filler breaks them, so the filler owns them. The checks
 * read them through here; `fallbackAnswers` is the checker's own "no
 * engine" default.
 */

export type {
  Ancestor,
  ClaimedPrimitives,
  EngineAnswers,
  ScopeFact,
  Surfaces,
  SurfacesOptions,
  UtilityFamily,
} from "@spinjs/preset";
import type { EngineAnswers } from "@spinjs/preset";

/**
 * No answers: the engine was never asked.
 *
 * A host that cannot fill the engine's answers (a unit test walking one
 * rule, a linter run before warmup) gets empty families, no primitives,
 * and silent surfaces — and the checks abstain rather than guess, the
 * same way they treat an unreadable vocabulary.
 */
export function fallbackAnswers(): EngineAnswers {
  return {
    families: [],
    primitives: { scopes: [], variants: new Set() },
    surfaces: {
      element: () => new Map(),
      utility: () => new Map(),
      variants: () => [],
      worn: () => new Map(),
    },
  };
}
