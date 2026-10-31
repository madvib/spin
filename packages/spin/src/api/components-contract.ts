/**
 * The components contract: primitives, machines, and vendored examples.
 *
 * One RPC service for both kinds Spin ships. CSS primitives (28 entries)
 * carry their contract and showcase rows in memory; runtime machines (36)
 * ship `examples/*.html` beside each def, so the directory listing IS the
 * list — no index, no map. `kind` tells a caller which one an entry is.
 * Users discover components over RPC and copy examples into their projects
 * at a known location (`spin/<component>/<example>.html`).
 */

import { oc } from "@orpc/contract";
import * as v from "valibot";

const ComponentName = v.pipe(
  v.string(),
  v.minLength(1),
  v.description("Component name, e.g. 'button' or 'tree-view'."),
);

/** One row of a component's showcase, as the RPC surface carries it. */
const PrimitiveExampleRow = v.object({
  name: v.string(),
  html: v.string(),
});

const PrimitiveClassDoc = v.object({
  name: v.string(),
  kind: v.string(),
  description: v.string(),
});

const PrimitiveExamples = v.object({
  note: v.string(),
  /** The script that finishes an example markup alone cannot finish. */
  onLoad: v.optional(v.string()),
  classes: v.optional(v.array(PrimitiveClassDoc)),
  rows: v.array(PrimitiveExampleRow),
});

/** One vendored machine example, as the RPC surface carries it. */
const MachineExampleRow = v.object({
  name: v.string(),
  title: v.string(),
  html: v.string(),
  /** The mount tag (`slider-basic`), rendered in the preview stage. */
  mountHtml: v.string(),
  /** The example stem (`basic`), for the copy-to-project call. */
  stem: v.string(),
  /** Runs against the row after it mounts, for property-driven examples. */
  onLoad: v.optional(v.string()),
});

const MachineExamples = v.object({
  note: v.string(),
  rows: v.array(MachineExampleRow),
});

const ComponentTokenSchema = v.object({
  path: v.string(),
  type: v.string(),
  value: v.string(),
});

const ManifestSchema = v.object({
  parts: v.array(v.string()),
  slots: v.array(v.string()),
  readers: v.array(v.string()),
  methods: v.array(v.string()),
  commands: v.array(v.string()),
  events: v.array(v.string()),
});

const PrimitiveSummary = v.object({
  kind: v.literal("primitive"),
  name: v.string(),
  tags: v.array(v.string()),
  variants: v.array(v.string()),
  /**
   * The custom properties this component reads, so one call carries both the
   * vocabulary and what it spends.
   */
  reads: v.array(v.string()),
  examples: v.optional(PrimitiveExamples),
});

const MachineSummary = v.object({
  kind: v.literal("machine"),
  name: v.string(),
  tags: v.array(v.string()),
  variants: v.array(v.string()),
  reads: v.array(v.string()),
  manifest: ManifestSchema,
  examples: MachineExamples,
});

const ComponentSummary = v.union([PrimitiveSummary, MachineSummary]);

const PrimitiveContractOutput = v.object({
  kind: v.literal("primitive"),
  name: v.string(),
  tags: v.array(v.string()),
  variants: v.array(v.string()),
  reads: v.array(v.string()),
  component: v.array(ComponentTokenSchema),
  examples: v.optional(PrimitiveExamples),
});

const MachineContractOutput = v.object({
  kind: v.literal("machine"),
  name: v.string(),
  tags: v.array(v.string()),
  variants: v.array(v.string()),
  reads: v.array(v.string()),
  manifest: ManifestSchema,
  examples: MachineExamples,
});

const ContractOutput = v.union([
  PrimitiveContractOutput,
  MachineContractOutput,
]);

const ContractError = v.object({
  error: v.string(),
});

const ContractResult = v.union([ContractOutput, ContractError]);

const TokensOutput = v.object({
  reads: v.record(v.string(), v.array(v.string())),
});

const ExamplesOutput = v.object({
  examples: v.array(MachineExampleRow),
});

const CopyOutput = v.object({
  /** The path written, relative to the project root. */
  file: v.nullable(v.string()),
  /** The custom element tag the file registers (`<moniker>-<name>-<example>`). Null when the write failed. */
  tag: v.nullable(v.string()),
  error: v.nullable(v.string()),
  /** Where the copy landed when the components resolve to a shared package. */
  note: v.optional(v.string()),
});

/** List every component — primitives first, then machines — with reads. */
export const list = oc
  .input(v.object({}))
  .output(v.array(ComponentSummary))
  .route({
    method: "POST",
    path: "/components/list",
    summary: "List primitives and machines with examples",
  });

/** Get the full contract for one component, or an error if unknown. */
export const contract = oc
  .input(v.object({ name: ComponentName }))
  .output(ContractResult)
  .route({
    method: "POST",
    path: "/components/contract",
    summary: "Get a component's contract",
  });

/** List custom properties components read, grouped by token group. */
export const tokens = oc
  .input(
    v.object({
      name: v.optional(ComponentName),
    }),
  )
  .output(TokensOutput)
  .route({
    method: "POST",
    path: "/components/tokens",
    summary: "List token reads by group",
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

/** Copy one machine example into the caller's project at its known location. */
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
    summary: "Copy a machine example into the project",
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
    contract,
    tokens,
    examples,
    copy,
    reads,
  },
};
