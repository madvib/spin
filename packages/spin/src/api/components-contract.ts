/**
 * The components contract: machines, the framework, and vendored examples.
 *
 * We do not publish a component library. Each machine ships `examples/`
 * beside it — consumer-ready examples translated from the tark surface —
 * and this contract is how users discover them over RPC and copy them into
 * their projects at a known location (`spin/<component>/<example>.html`).
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";

const ComponentName = v.pipe(
  v.string(),
  v.minLength(1),
  v.description("Machine name, e.g. 'tree-view'."),
);

/** One vendored example, as the RPC surface carries it. */
const ExampleRow = v.object({
  name: v.string(),
  title: v.string(),
  html: v.string(),
});

const ComponentManifestSchema = v.object({
  parts: v.array(v.string()),
  slots: v.array(v.string()),
  readers: v.array(v.string()),
  methods: v.array(v.string()),
  commands: v.array(v.string()),
  events: v.array(v.string()),
});

const ComponentSummary = v.object({
  name: v.string(),
  examples: v.array(v.string()),
  manifest: ComponentManifestSchema,
});

const ExamplesOutput = v.object({
  examples: v.array(ExampleRow),
});

const CopyOutput = v.object({
  /** The path written, relative to the project root. */
  file: v.nullable(v.string()),
  error: v.nullable(v.string()),
});

/** List every machine with its vendored example names. */
export const list = oc
  .input(v.object({}))
  .output(v.array(ComponentSummary))
  .route({
    method: "POST",
    path: "/components/list",
    summary: "List machines with vendored examples",
  });

/** Get one machine's examples, or an empty list when it ships none yet. */
export const examples = oc
  .input(v.object({ name: ComponentName }))
  .output(ExamplesOutput)
  .route({
    method: "POST",
    path: "/components/examples",
    summary: "Get a machine's examples",
  });

/** Copy one example into the caller's project at its known location. */
export const copy = oc
  .input(
    v.object({
      name: ComponentName,
      example: v.string(),
      root: v.optional(v.string()),
    }),
  )
  .output(CopyOutput)
  .route({
    method: "POST",
    path: "/components/copy",
    summary: "Copy an example into the project",
  });

/** The CSS variables a machine's examples spend, sorted and deduplicated. */
export const reads = oc
  .input(v.object({ name: ComponentName }))
  .output(v.object({ reads: v.array(v.string()) }))
  .route({
    method: "POST",
    path: "/components/reads",
    summary: "Get a machine's CSS variable reads",
  });

export const componentsContract = {
  components: {
    list,
    examples,
    copy,
    reads,
  },
};
