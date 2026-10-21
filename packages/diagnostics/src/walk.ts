/**
 * Walking a tree the way a linter does.
 *
 * ESLint and oxlint walk the tree themselves and hand each rule the node
 * it is on; the CLI has no linter, so it walks the tree here. The walk
 * matches theirs in the two ways that matter: a node is visited once, in
 * the order it appears in the source, and every node carries a link to the
 * one that holds it — the rules read the enclosing tag from a node's
 * parent.
 */

/**
 * The shape of a node, as far as the walk and the rules care.
 *
 * The fields the rules read are named here; everything else the tree
 * carries is left alone.
 */
export interface WalkNode {
  type: string;
  name?: { name?: string } | null;
  value?: unknown;
  parent?: WalkNode | null;
  loc?: { start: { line: number; column: number } } | null;
  [key: string]: unknown;
}

/** Whether a value in the tree is a node. */
function isNode(value: unknown): value is WalkNode {
  return typeof value === "object" && value !== null &&
    typeof (value as { type?: unknown }).type === "string";
}

/**
 * Visit every node of the tree, in source order.
 *
 * The parent link is set before the node is visited, exactly as a linter
 * sets it: a rule reads the enclosing tag from it.
 */
export function walk(root: WalkNode, visit: (node: WalkNode) => void): void {
  const seen = new Set<unknown>();
  const step = (node: WalkNode, parent?: WalkNode): void => {
    if (seen.has(node)) return;
    seen.add(node);
    if (parent !== undefined) node.parent = parent;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isNode(item)) step(item, node);
        }
      } else if (isNode(value)) {
        step(value, node);
      }
    }
  };
  step(root);
}
