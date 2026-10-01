/**
 * Token tree -> resolved token tree.
 *
 * Also the single place that knows how to *address* a token in a tree, because
 * every downstream stage (CSS emission, validation) needs the same answer to
 * "what does `{color.primary}` mean". Addresses resolve in one step, in
 * priority order: exact DTCG path (`color.primary`), then the CSS custom
 * property name (`color-primary`) so a file written in either dialect works.
 *
 * Resolution never throws. A cycle or a dangling reference leaves the alias
 * text in place and is reported, because the caller generating CSS still wants
 * to emit a file and the caller validating wants the full list.
 */

import type {
  ResolvedTokenTree,
  TokenLeaf,
  TokenNode,
  TokenTree,
} from "./types.ts";

/** `{color.primary}` — a whole-value DTCG alias. */
const ALIAS = /^\{([^{}]+)\}$/;

/** Custom property name a leaf emits under. */
export function cssVarName(path: string[], prefix?: string): string {
  const base = path.join("-").toLowerCase();
  return prefix ? `--${prefix}-${base}` : `--${base}`;
}

/** True when a value is a whole-value alias reference. */
export function isAliasValue(value: unknown): value is string {
  return typeof value === "string" && ALIAS.test(value.trim());
}

/** The path an alias points at, without braces. Null when not an alias. */
export function aliasTarget(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = ALIAS.exec(value.trim());
  return match ? (match[1] as string).trim() : null;
}

/** Every node of a tree, addressed by DTCG path. */
export interface TokenIndex {
  /** Dotted path -> node. Groups and leaves alike. */
  nodes: Record<string, TokenNode>;
  /** Dotted path -> leaf. Leaves only. */
  leaves: Record<string, TokenLeaf>;
  /** Custom property name (no `--`) -> leaf. */
  vars: Record<string, TokenLeaf>;
}

/** Index a tree so tokens can be looked up by path instead of walked. */
export function indexTree(tree: TokenTree): TokenIndex {
  const index: TokenIndex = { nodes: {}, leaves: {}, vars: {} };

  const visit = (nodes: TokenNode[]): void => {
    for (const node of nodes) {
      const key = node.path.join(".");
      index.nodes[key] = node;
      if (node.kind === "token") {
        index.leaves[key] = node;
        index.vars[cssVarName(node.path).slice(2)] = node;
      } else {
        visit(node.children);
      }
    }
  };

  visit(tree);
  return index;
}

/**
 * Resolve an address to a node: exact DTCG path first, then CSS var name.
 * Returns null for a dangling reference.
 */
export function lookupNode(
  index: TokenIndex,
  address: string,
): TokenNode | null {
  return index.nodes[address] ?? index.vars[address.replace(/^--/, "")] ?? null;
}

/** Resolve an address to a leaf, for alias following. */
function lookupLeaf(index: TokenIndex, address: string): TokenLeaf | null {
  const node = lookupNode(index, address);
  return node !== null && node.kind === "token" ? node : null;
}

/**
 * Follow an alias chain to the leaf that holds the concrete value.
 *
 * Returns null when the chain dangles, ends on a group, or revisits a node —
 * a cycle has no value, and saying so is more useful than looping.
 */
function followChain(index: TokenIndex, from: string): TokenLeaf | null {
  const visited = new Set<string>([from]);
  let cursor: TokenLeaf | null = lookupLeaf(index, from);

  while (cursor !== null) {
    const target = aliasTarget(cursor.value);
    if (target === null) return cursor;
    const next = lookupLeaf(index, target);
    if (next === null || visited.has(next.path.join("."))) return null;
    visited.add(next.path.join("."));
    cursor = next;
  }

  return null;
}

/**
 * Every alias cycle in the tree, each as the DTCG paths that form it.
 *
 * A cycle is reported once even when several tokens feed into it.
 */
export function detectCycles(tree: TokenTree): string[][] {
  const index = indexTree(tree);
  const cycles: string[][] = [];
  const reported = new Set<string>();

  for (const key of Object.keys(index.leaves)) {
    const chain: string[] = [];
    const onChain = new Set<string>();
    let cursor: string | null = key;

    while (cursor !== null && !onChain.has(cursor)) {
      onChain.add(cursor);
      chain.push(cursor);
      const target = aliasTarget(index.leaves[cursor]?.value);
      const next = target === null ? null : lookupLeaf(index, target);
      cursor = next === null ? null : next.path.join(".");
    }

    if (cursor === null) continue;
    const cycle = chain.slice(chain.indexOf(cursor));
    const canonical = [...cycle].sort().join(">");
    if (reported.has(canonical)) continue;
    reported.add(canonical);
    cycles.push(cycle);
  }

  return cycles;
}

/**
 * Replace every resolvable alias with the value it points at.
 *
 * The input is not mutated. Leaves on a cycle, and leaves whose alias does not
 * exist, keep their `{...}` text and are listed in the result.
 */
export function resolveAliases(tree: TokenTree): ResolvedTokenTree {
  const index = indexTree(tree);
  const cycles = detectCycles(tree);
  const unresolved: string[] = [];

  const clone = (nodes: TokenNode[]): TokenNode[] =>
    nodes.map((node) => {
      if (node.kind === "token") {
        const copy: TokenLeaf = { ...node };
        if (isAliasValue(node.value)) {
          const source = followChain(index, node.path.join("."));
          if (source === null) {
            unresolved.push(node.path.join("."));
          } else {
            copy.value = source.value;
          }
        }
        return copy;
      }
      const group = { ...node, children: clone(node.children) };
      return group;
    });

  return { tree: clone(tree), cycles, unresolved };
}
