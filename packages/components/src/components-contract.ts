/**
 * The components contract: machines, the framework, and vendored variants.
 *
 * We do not publish a component library. Each machine ships `*.variants.ts`
 * beside it — consumer-ready examples translated from the tark surface —
 * and this contract is how users discover them over RPC and copy them into
 * their projects at a known location (`spin/<component>/<variant>.html`).
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";

const ComponentName = v.pipe(
  v.string(),
  v.minLength(1),
  v.description("Machine name, e.g. 'tree-view'."),
);

/** One vendored variant, as the RPC surface carries it. */
const VariantRow = v.object({
  name: v.string(),
  title: v.string(),
  html: v.string(),
});

const ComponentSummary = v.object({
  name: v.string(),
  variants: v.array(v.string()),
});

const VariantsOutput = v.object({
  variants: v.array(VariantRow),
});

const CopyOutput = v.object({
  /** The path written, relative to the project root. */
  file: v.nullable(v.string()),
  error: v.nullable(v.string()),
});

/** List every machine with its vendored variant names. */
export const list = oc
  .input(v.object({}))
  .output(v.array(ComponentSummary))
  .route({
    method: "POST",
    path: "/components/list",
    summary: "List machines with vendored variants",
  });

/** Get one machine's variants, or an empty list when it ships none yet. */
export const variants = oc
  .input(v.object({ name: ComponentName }))
  .output(VariantsOutput)
  .route({
    method: "POST",
    path: "/components/variants",
    summary: "Get a machine's variants",
  });

/** Copy one variant into the caller's project at its known location. */
export const copy = oc
  .input(
    v.object({
      name: ComponentName,
      variant: v.string(),
      root: v.optional(v.string()),
    }),
  )
  .output(CopyOutput)
  .route({
    method: "POST",
    path: "/components/copy",
    summary: "Copy a variant into the project",
  });

export const componentsContract = {
  components: {
    list,
    variants,
    copy,
  },
};
