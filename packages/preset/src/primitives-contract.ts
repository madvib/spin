/**
 * Procedures — the typed interface a studio or an MCP client reads a
 * component contract through.
 *
 * Contract-first oRPC: this file describes every procedure (input, output, no
 * logic) with `oc` from `@orpc/contract`. `procedures.ts` implements it. The
 * api package re-exports both and adds transport; a client needs only this
 * file, so no server code can leak into a bundle.
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";

const ComponentName = v.pipe(
  v.string(),
  v.minLength(1),
  v.description("Component name, e.g. 'button'."),
);

const ComponentSummary = v.object({
  name: v.string(),
  tags: v.array(v.string()),
  variants: v.array(v.string()),
});

const ContractOutput = v.object({
  tags: v.array(v.string()),
  variants: v.array(v.string()),
  reads: v.array(v.string()),
  character: v.array(v.object({
    path: v.string(),
    type: v.string(),
    value: v.string(),
  })),
});

const ContractError = v.object({
  error: v.string(),
});

const ContractResult = v.union([ContractOutput, ContractError]);

const TokensOutput = v.object({
  reads: v.record(v.string(), v.array(v.string())),
});

/** List every primitive component with its name, tags, and variants. */
export const list = oc
  .input(v.object({}))
  .output(v.array(ComponentSummary))
  .route({
    method: "POST",
    path: "/primitives/list",
    summary: "List all primitive components",
  });

/** Get the full contract for one component, or an error if unknown. */
export const contract = oc
  .input(v.object({ name: ComponentName }))
  .output(ContractResult)
  .route({
    method: "POST",
    path: "/primitives/contract",
    summary: "Get a component's contract",
  });

/** List custom properties the primitives read, grouped by token group. */
export const tokens = oc
  .input(
    v.object({
      name: v.optional(ComponentName),
    }),
  )
  .output(TokensOutput)
  .route({
    method: "POST",
    path: "/primitives/tokens",
    summary: "List token reads by group",
  });

export const primitivesContract = {
  primitives: {
    list,
    contract,
    tokens,
  },
};
