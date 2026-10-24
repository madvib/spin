/**
 * Implements {@link primitivesContract}. Each handler is a thin wrapper over
 * the in-memory component data — pure, no fs, no cwd, no env.
 */

import { implement } from "@orpc/server";

import {
  primitiveComponents,
  primitiveReadsByGroup,
} from "./rules/primitives/manifest.ts";
import { componentExamples } from "./rules/primitives/examples-index.ts";
import { primitivesContract } from "./primitives-contract.ts";

// Re-exported so a consumer can reach the contract and the handlers from one
// module, which is what the import map entry names.
export { primitivesContract };

const os = implement(primitivesContract);

/**
 * Every component a reader can browse: the ones that ship examples.
 *
 * The manifest is not that set. It also holds `a11y`, a utility family, and
 * `field`, the contract input/textarea share — neither is something a
 * gallery card can open. And it misses the components whose examples are
 * authored beside rules it does not name at all. The gallery is therefore
 * driven by what has something to show, and the manifest's tags, variants and
 * reads ride along wherever it models the same name.
 */
export function listedComponents(): {
  name: string;
  tags: string[];
  variants: string[];
  reads: string[];
  examples?: {
    onLoad?: string;
    note: string;
    rows: { name: string; html: string }[];
  };
}[] {
  return Object.values(componentExamples).map((examples) => {
    const component = primitiveComponents[examples.id];
    return {
      name: examples.id,
      tags: [...(component?.tags ?? [])],
      variants: [...(component?.variants ?? [])],
      reads: [...(component?.reads ?? [])],
      examples: {
        ...(examples.onLoad !== undefined ? { onLoad: examples.onLoad } : {}),
        note: examples.note,
        rows: [...examples.rows],
      },
    };
  });
}

const list = os.primitives.list.handler(() => listedComponents());

const contract = os.primitives.contract.handler(({ input }) => {
  const component = primitiveComponents[input.name];
  if (!component) return { error: `Unknown component: ${input.name}` };
  return {
    tags: [...component.tags],
    variants: [...component.variants],
    reads: [...component.reads],
    component: [...component.component],
  };
});

const tokens = os.primitives.tokens.handler(({ input }) => {
  const all = primitiveReadsByGroup();
  if (!input.name) return { reads: all };
  const component = primitiveComponents[input.name];
  if (!component) return { reads: {} };
  const componentReads: ReadonlySet<string> = new Set(component.reads);
  const filtered: Record<string, string[]> = {};
  for (const [group, tokens] of Object.entries(all)) {
    const matching = tokens.filter((t) => componentReads.has(t));
    if (matching.length > 0) filtered[group] = matching;
  }
  return { reads: filtered };
});

export const primitivesRouter = os.router({
  primitives: {
    list,
    contract,
    tokens,
  },
});
