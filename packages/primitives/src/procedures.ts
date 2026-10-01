/**
 * Implements {@link primitivesContract}. Each handler is a thin wrapper over
 * the in-memory component data — pure, no fs, no cwd, no env.
 */

import { implement } from "@orpc/server";

import {
  generatePrimitivesCss,
  primitiveComponents,
  primitiveReadsByGroup,
} from "./index.ts";
import { primitivesContract } from "./contract.ts";

const os = implement(primitivesContract);

const list = os.primitives.list.handler(() => {
  return Object.values(primitiveComponents).map((c) => ({
    name: c.name,
    tags: [...c.tags],
    variants: [...c.variants],
  }));
});

const contract = os.primitives.contract.handler(({ input }) => {
  const component = primitiveComponents[input.name];
  if (!component) return { error: `Unknown component: ${input.name}` };
  return {
    tags: [...component.tags],
    variants: [...component.variants],
    reads: [...component.reads],
    character: [...component.character],
  };
});

const css = os.primitives.css.handler(({ input }) => ({
  css: generatePrimitivesCss(input.components),
}));

const tokens = os.primitives.tokens.handler(({ input }) => {
  const all = primitiveReadsByGroup();
  if (!input.name) return { reads: all };
  const component = primitiveComponents[input.name];
  if (!component) return { reads: {} };
  const componentReads = new Set(component.reads);
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
    css,
    tokens,
  },
});
