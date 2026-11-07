/**
 * The components over RPC — never by importing the preset.
 *
 * The studio used to import `@spinjs/preset/rules/primitives/manifest.ts`
 * directly, which shipped the whole domain into the browser bundle and meant
 * the studio's component pages described the library rather than read it:
 * four pages of hand-written markup, none of it the ledger. Every consumer
 * reads the same `components.list`, so there is one answer to "what are the
 * button examples" and it lives with the rules.
 */

import { EXAMPLE_ONLOAD } from "@spinjs/spin/examples";
import { spinClient } from "./client.ts";

/** One example row, as the RPC surface carries it. */
export interface RpcExample {
  readonly name: string;
  readonly html: string;
  /** The mount tag for machine examples (`slider-basic`), rendered in the preview stage. */
  readonly mountHtml?: string;
  /** The example stem (`basic`), for the copy-to-project call. */
  readonly stem?: string;
  /** Runs against the row after it mounts, for property-driven examples. */
  readonly onLoad?: string;
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
  readonly examples?: {
    readonly note: string;
    /** The line that finishes an example markup alone cannot finish. */
    readonly onLoad?: string;
    readonly classes?: readonly {
      readonly name: string;
      readonly kind: string;
      readonly description: string;
    }[];
    readonly rows: readonly RpcExample[];
  };
}

type ListedEntry = {
  readonly name: string;
  readonly tags: readonly string[];
  readonly variants: readonly string[];
  readonly reads: readonly string[];
  readonly manifest?: RpcComponent["manifest"];
  readonly examples?: RpcComponent["examples"];
};

/** Every component, in one call. Primitives plus machine components. */
export async function listPrimitives(): Promise<readonly RpcComponent[]> {
  const client = await spinClient();
  const listed = (await client.components.list({})) as readonly ListedEntry[];
  return listed.map((entry) => {
    if (entry.manifest !== undefined) {
      const examples = entry.examples === undefined
        ? undefined
        : {
          ...entry.examples,
          rows: entry.examples.rows.map((row) => {
            const onLoad = row.stem !== undefined
              ? (EXAMPLE_ONLOAD[`${entry.name}/${row.stem}`] ?? row.onLoad)
              : row.onLoad;
            return onLoad === undefined ? row : { ...row, onLoad };
          }),
        };
      return {
        name: `component-${entry.name}`,
        kind: "machine" as const,
        manifest: entry.manifest,
        tags: [...entry.tags],
        variants: [...entry.variants],
        reads: [...entry.reads],
        examples,
      };
    }
    return {
      name: entry.name,
      kind: "primitive" as const,
      tags: [...entry.tags],
      variants: [...entry.variants],
      reads: [...entry.reads],
      examples: entry.examples,
    };
  });
}

/** Copy one machine example into the project at `spin/<name>/<example>.html`. */
export async function copyComponentExample(
  name: string,
  example: string,
): Promise<{ file: string | null; tag: string | null; error: string | null }> {
  const bare = name.startsWith("component-")
    ? name.slice("component-".length)
    : name;
  return (await spinClient()).components.copy({ name: bare, example });
}

/** One component token a component declares: its path, type, scaffold value. */
export interface RpcComponentToken {
  readonly path: string;
  readonly type: string;
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
 * `components.list` does not carry for machines: the manifest's authored idea
 * of what `button.shadow` starts at, so the component page can offer to CREATE
 * the token in themes that do not have it yet, scaffolded as authored.
 *
 * Undefined when the daemon knows no such component: the RPC spells that as
 * an error union rather than a failed call, and a page whose name does not
 * exist should reach its own "no component" fallback rather than crash on a
 * missing field.
 */
export async function primitivesContract(
  name: string,
): Promise<RpcContract | undefined> {
  const result = await (await spinClient()).components.contract({ name });
  if ("error" in result) return undefined;
  if (result.kind !== "primitive") return undefined;
  return {
    tags: [...result.tags],
    variants: [...result.variants],
    reads: [...result.reads],
    component: [...result.component],
  };
}

/** The custom properties a component reads, grouped by token group. */
export async function primitivesTokens(name: string) {
  return await (await spinClient()).components.tokens({ name });
}

export { EXAMPLE_ONLOAD };

export function displayComponentName(name: string): string {
  return name.replace(/^component-/, "").replace(/-/g, " ");
}

/** One unified rail group: a purpose, and the rows filed under it. */
export interface UnifiedGroup {
  readonly label: string;
  readonly rows: readonly { readonly name: string; readonly icon: string }[];
}
import { UNIFIED_COMPONENT_GROUPS } from "@spinjs/components";
const UNIFIED = UNIFIED_COMPONENT_GROUPS;

/**
 * The unified rail: every component filed by purpose, primitives and machines
 * side by side, in the order a reader arrives in.
 *
 * Anything the taxonomy does not name lands in "Other" rather than vanishing:
 * a rail that drops a component it was given is a rail lying about the
 * library. Rows sort by their display name, so the filing is stable however
 * the daemon lists them.
 */
export function unifiedComponentGroups(
  items: readonly RpcComponent[],
  filter: "all" | "primitive" | "machine",
  query: string,
  icons: Readonly<Record<string, string>>,
): readonly UnifiedGroup[] {
  const needle = query.trim().toLowerCase();
  const kept = new Map<string, RpcComponent>();
  for (const item of items) {
    if (filter !== "all" && item.kind !== filter) continue;
    if (
      needle !== "" &&
      !displayComponentName(item.name).includes(needle) &&
      !item.name.replace(/-/g, " ").includes(needle)
    ) continue;
    kept.set(item.name, item);
  }
  const rowOf = (name: string) => ({
    name,
    icon: icons[name] ?? "i-lucide-box",
  });
  const byName = (a: { name: string }, b: { name: string }): number =>
    displayComponentName(a.name).localeCompare(displayComponentName(b.name));
  const groups = UNIFIED.map((group) => ({
    label: group.label,
    rows: group.members
      .filter((name) => kept.has(name))
      .map(rowOf)
      .sort(byName),
  })).filter((group) => group.rows.length > 0);
  const filed = new Set(UNIFIED.flatMap((group) => group.members));
  const rest = [...kept.keys()]
    .filter((name) => !filed.has(name))
    .map(rowOf)
    .sort(byName);
  if (rest.length > 0) groups.push({ label: "Other", rows: rest });
  return groups;
}
