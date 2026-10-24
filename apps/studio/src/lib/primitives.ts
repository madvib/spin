/**
 * The components over RPC — never by importing the preset.
 *
 * The studio used to import `@spinjs/preset/rules/primitives/manifest.ts`
 * directly, which shipped the whole domain into the browser bundle and meant
 * the studio's component pages described the library rather than read it:
 * four pages of hand-written markup, none of it the ledger. Every consumer
 * reads the same `primitives.list`, so there is one answer to "what are the
 * button examples" and it lives with the rules.
 */

import { spinClient } from "./client.ts";
import { EXAMPLE_ONLOAD } from "@spinjs/kit";

/** One example row, as the RPC surface carries it. */
export interface RpcExample {
  readonly name: string;
  readonly html: string;
  /** The mount tag for machine examples (`slider-basic`), rendered in the preview stage. */
  readonly mountHtml?: string;
  /** The example stem (`basic`), for the copy-to-project call. */
  readonly stem?: string;
}

/** One component, with its examples, in one payload. */
export interface RpcComponent {
  readonly name: string;
  readonly kind?: "primitive" | "machine";
  readonly manifest?: {
    readonly parts: readonly string[];
    readonly slots: readonly string[];
    readonly readers: readonly string[];
    readonly methods: readonly string[];
    readonly commands: readonly string[];
    readonly events: readonly string[];
  };
  readonly tags: readonly string[];
  readonly variants: readonly string[];
  /** The custom properties this component reads, so one call carries both
   * the vocabulary and what it spends. */
  readonly reads: readonly string[];
  readonly examples?: {
    readonly note: string;
    /** The line that finishes an example markup alone cannot finish. */
    readonly onLoad?: string;
    readonly rows: readonly RpcExample[];
  };
}

/** Every component, in one call. Primitives plus machine components. */
export async function listPrimitives(): Promise<readonly RpcComponent[]> {
  const client = await spinClient();
  const [primitives, machines] = await Promise.all([
    client.primitives.list({}),
    client.components.list({}),
  ]);
  const rows = machines as unknown as {
    readonly name: string;
    readonly examples: readonly string[];
    readonly manifest: RpcComponent["manifest"];
  }[];
  const machineRows = await Promise.all(
    rows.map(async (entry) => {
      const [ex, rd] = await Promise.all([
        client.components.examples({ name: entry.name }),
        client.components.reads({ name: entry.name }),
      ]);
      return { entry, examples: ex.examples, reads: rd.reads };
    }),
  );
  return [
    ...(primitives as readonly RpcComponent[]),
    ...machineRows.map(({ entry, examples, reads }) => ({
      name: `component-${entry.name}`,
      kind: "machine" as const,
      manifest: entry.manifest,
      tags: [`spin-${entry.name}`],
      variants: [...entry.examples],
      reads: [...reads],
      examples: {
        note:
          "Interactive machine component. Requires the runtime (@spinjs/runtime).",
        rows: examples.map((row) => {
          const stem = row.name;
          const onLoad = EXAMPLE_ONLOAD[`${entry.name}/${stem}`];
          return {
            name: `${entry.name} — ${row.title}`,
            html: row.html,
            mountHtml: `<${entry.name}-${stem}></${entry.name}-${stem}>`,
            stem,
            ...(onLoad !== undefined ? { onLoad } : {}),
          };
        }),
      },
    })),
  ];
}

/** Copy one machine example into the project at `spin/<name>/<example>.html`. */
export async function copyComponentExample(
  name: string,
  example: string,
): Promise<{ file: string | null; error: string | null }> {
  const bare = name.startsWith("component-")
    ? name.slice("component-".length)
    : name;
  return (await spinClient()).components.copy({ name: bare, example });
}

/** One component token a component declares: its path, type, scaffold value. */
export interface RpcComponentToken {
  readonly path: string;
  readonly type: string;
  /** What the token starts at — a manifest default, sometimes a reference
   * like `{border.width}` that the document resolves as authored. */
  readonly value: string;
}

/** One component's contract: vocabulary, reads, and its component tokens. */
export interface RpcContract {
  readonly tags: readonly string[];
  readonly variants: readonly string[];
  readonly reads: readonly string[];
  readonly component: readonly RpcComponentToken[];
}

/**
 * A component's contract in one call — chiefly the component-token axis, which
 * `primitives.list` does not carry: the manifest's authored idea of what
 * `button.weight` starts at, so the component page can offer to CREATE the
 * token in themes that do not have it yet, scaffolded as authored.
 *
 * Undefined when the daemon knows no such component: the RPC spells that as
 * an error union rather than a failed call, and a page whose name does not
 * exist should reach its own "no component" fallback rather than crash on a
 * missing field.
 */
export async function primitivesContract(
  name: string,
): Promise<RpcContract | undefined> {
  const result = await (await spinClient()).primitives.contract({ name });
  if ("error" in result) return undefined;
  return result;
}

/** The custom properties a component reads, grouped by token group. */
export async function primitivesTokens(name: string) {
  return await (await spinClient()).primitives.tokens({ name });
}
