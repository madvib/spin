/**
 * Token tree mutations.
 *
 * The studio edits themes as untyped string surgery on the JSON text. These
 * ops work on the parsed `TokenTree` instead: typed paths, typed values,
 * structured errors. Text round-trip stays separate (`treeToJson`), so a
 * caller parses once, mutates freely, and serialises once.
 *
 * Every op returns a result rather than throwing: a mutation the tree rejects
 * is feedback for the author, not a crash. Inputs are never mutated; outputs
 * are fresh trees sharing nothing with the input.
 */

import { requiredPaths } from "../contract/roles.ts";
import { isTokenType } from "../pipeline/parse.ts";
import type {
  TokenGroup,
  TokenLeaf,
  TokenNode,
  TokenTree,
  TokenType,
} from "../pipeline/types.ts";

/**
 * Why a mutation was refused.
 *
 * A closed set rather than free text, because every caller is an editor or an
 * agent: a studio renders the failure, an MCP client branches on it, and
 * neither should be pattern-matching a sentence to find out what went wrong.
 * `path` says which token, `detail` carries whatever makes this particular
 * occurrence readable.
 *
 * The list is a value, not just a type, because the contract's wire schema
 * reads it: a code cannot exist in the vocabulary and not on the wire.
 */
export const MUTATION_ERROR_CODES = [
  "empty-path",
  "group-not-token",
  "missing-token",
  "occupied-target",
  // The path names a token the contract requires, so removing it leaves a
  // theme that does not build.
  "required-token",
  "type-mismatch",
  "type-required",
] as const;

export type MutationErrorCode = (typeof MUTATION_ERROR_CODES)[number];

export interface MutationError {
  readonly ok: false;
  readonly code: MutationErrorCode;
  /** The token the failure concerns, dotted. Empty when the path itself is wrong. */
  readonly path: string;
  /** Human-readable specifics for this occurrence. */
  readonly detail: string;
}

export type MutationResult =
  | { ok: true; tree: TokenTree }
  | MutationError;

/** Build a refusal. The code says what happened; the detail says how. */
function fail(
  code: MutationErrorCode,
  path: readonly string[],
  detail: string,
): MutationError {
  return { ok: false, code, path: path.join("."), detail };
}

function cloneNode(node: TokenNode): TokenNode {
  if (node.kind === "token") {
    return {
      kind: "token",
      name: node.name,
      path: [...node.path],
      type: node.type,
      value: node.value,
      // A clone that dropped `modes` would make every mutation silently
      // delete the document's dark values — the trees here are round-tripped
      // whole, so every field a leaf can carry travels.
      ...(node.modes !== undefined ? { modes: { ...node.modes } } : {}),
      ...(node.description !== undefined
        ? { description: node.description }
        : {}),
    };
  }
  return {
    kind: "group",
    name: node.name,
    path: [...node.path],
    ...(node.type !== undefined ? { type: node.type } : {}),
    ...(node.description !== undefined
      ? { description: node.description }
      : {}),
    children: node.children.map(cloneNode),
  };
}

function cloneTree(tree: TokenTree): TokenTree {
  return tree.map(cloneNode);
}

/**
 * Walk to the parent group of `path`, creating missing groups on the way.
 *
 * Named for what it does rather than what it looks like: it writes. Every
 * caller passes a clone and relies on the groups it inserts, so a name like
 * `parentOf` would suggest a query. Its result follows the same `{ok}` shape
 * as every other outcome in this module, so callers discriminate the same way
 * everywhere rather than probing for a property.
 */
function resolveParentForWrite(
  roots: TokenTree,
  path: string[],
): { ok: true; parent: TokenNode[]; name: string } | MutationError {
  if (path.length === 0) {
    return fail("empty-path", path, "path must name at least one segment");
  }
  let level: TokenNode[] = roots;
  for (const segment of path.slice(0, -1)) {
    let next = level.find((node) => node.name === segment);
    if (next === undefined) {
      const group: TokenGroup = {
        kind: "group",
        name: segment,
        path: [],
        children: [],
      };
      level.push(group);
      next = group;
    }
    if (next.kind !== "group") {
      return fail(
        "group-not-token",
        path,
        `passes through token "${next.path.join(".")}"`,
      );
    }
    level = next.children;
  }
  return { ok: true, parent: level, name: path[path.length - 1] as string };
}

function repath(nodes: TokenNode[], prefix: string[]): void {
  for (const node of nodes) {
    if (node.kind === "group") {
      node.path = [...prefix, node.name];
      repath(node.children, node.path);
    } else if (prefix.length > 0) {
      // Leaves sit flat under their root group while their paths nest:
      // `neutral.50` lives in `color` with path `[color, neutral, 50]`.
      // Only the root follows the parent; the rest is the leaf's own.
      node.path = [prefix[0] as string, ...node.path.slice(1)];
    } else {
      node.path = [node.name];
    }
  }
}

/**
 * Set a token's `$value` by DTCG path. Creates the token (and any missing
 * parent groups) when absent; the declared `$type` is required on creation
 * and must match when present.
 *
 * With `mode`, the value is written as that mode's override
 * (`$modes.<mode>`) instead of the base value — the same edit the studio
 * makes when the dark slot is active. A mode value equal to the base is the
 * override's absence and removes the slot, so the document stays canonical
 * whoever wrote it. A token that does not exist cannot gain only an
 * override: refuse and let the caller set a base value first.
 */
export function setToken(
  tree: TokenTree,
  path: string[],
  value: unknown,
  type?: TokenType,
  mode?: string,
): MutationResult {
  const next = cloneTree(tree);
  const found = resolveParentForWrite(next, path);
  if (!found.ok) return found;
  const { parent, name } = found;
  const existing = parent.find((node) => node.name === name);
  if (existing !== undefined && existing.kind === "group") {
    return fail("group-not-token", path, "names a group, not a token");
  }
  if (existing !== undefined) {
    if (type !== undefined && type !== existing.type) {
      return fail(
        "type-mismatch",
        path,
        `is $${existing.type}, not $${type}`,
      );
    }
    if (mode !== undefined) {
      const modes = { ...existing.modes };
      if (JSON.stringify(value) === JSON.stringify(existing.value)) {
        delete modes[mode];
      } else {
        modes[mode] = value;
      }
      if (Object.keys(modes).length === 0) {
        delete existing.modes;
      } else {
        existing.modes = modes;
      }
      return { ok: true, tree: next };
    }
    existing.value = value;
    return { ok: true, tree: next };
  }
  if (mode !== undefined) {
    return fail(
      "missing-token",
      path,
      "has no base value to override — set the base value first",
    );
  }
  if (type === undefined || !isTokenType(type)) {
    return fail(
      "type-required",
      path,
      `needs a $type from the closed vocabulary`,
    );
  }
  const prefix = path.slice(0, -1);
  parent.push({
    kind: "token",
    name,
    path: [...prefix, name],
    type,
    value,
  });
  return { ok: true, tree: next };
}

/** Remove the token at `path`. Removing a group is refused: that is deletion, not editing. */
export function removeToken(
  tree: TokenTree,
  path: string[],
): MutationResult {
  // A required token cannot be dropped. Without this, `remove` happily
  // deletes `color.primary` and the failure surfaces three layers later as
  // "theme is incomplete" from the preset — correct, but far from the edit
  // that caused it, and the studio's gate is not the same body of rules as
  // this one. The mutation refuses its own contract violation.
  const required = new Set(requiredPaths());
  if (required.has(path.join("."))) {
    return fail(
      "required-token",
      path,
      "this token is required; a theme without it does not build",
    );
  }
  const next = cloneTree(tree);
  const found = resolveParentForWrite(next, path);
  if (!found.ok) return found;
  const { parent, name } = found;
  const at = parent.findIndex((node) => node.name === name);
  if (at === -1) return fail("missing-token", path, "no token at this path");
  if (parent[at]?.kind === "group") {
    return fail("group-not-token", path, "names a group, not a token");
  }
  parent.splice(at, 1);
  return { ok: true, tree: next };
}

/** Move or rename the token at `from` to `to`, preserving `$type` and description. */
export function renameToken(
  tree: TokenTree,
  from: string[],
  to: string[],
): MutationResult {
  const next = cloneTree(tree);
  const source = resolveParentForWrite(next, from);
  if (!source.ok) return source;
  const at = source.parent.findIndex(
    (node) => node.name === source.name,
  );
  if (at === -1) return fail("missing-token", from, "no token at this path");
  const moving = source.parent[at] as TokenNode;
  if (moving.kind === "group") {
    return fail("group-not-token", from, "names a group, not a token");
  }
  const target = resolveParentForWrite(next, to);
  if (!target.ok) return target;
  if (target.parent.some((node) => node.name === target.name)) {
    return fail("occupied-target", to, "a token already exists here");
  }
  source.parent.splice(at, 1);
  const leaf: TokenLeaf = {
    kind: "token",
    name: target.name,
    path: [...to],
    type: moving.type,
    value: moving.value,
    ...(moving.modes !== undefined ? { modes: { ...moving.modes } } : {}),
    ...(moving.description !== undefined
      ? { description: moving.description }
      : {}),
  };
  target.parent.push(leaf);
  repath(next, []);
  return { ok: true, tree: next };
}

/** Serialise a tree back to DTCG JSON text a theme file can store. */
export function treeToJson(tree: TokenTree): string {
  const doc: Record<string, unknown> = {};
  for (const node of tree) insertNode(doc, node);
  return JSON.stringify(doc, null, 2);
}

/**
 * Insert one node at its full path, creating intermediate objects. A token at
 * `color.semantic.success` nests three deep; the tree is flat by group, so
 * the path is the only structure the serializer can trust.
 */
function insertNode(doc: Record<string, unknown>, node: TokenNode): void {
  let level = doc;
  for (const segment of node.path.slice(0, -1)) {
    const next = level[segment];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      const fresh: Record<string, unknown> = {};
      level[segment] = fresh;
      level = fresh;
    } else {
      level = next as Record<string, unknown>;
    }
  }
  const existing = level[node.name];
  // A tree can hold two groups with the same name — merging a theme onto a
  // scaffold produces `color` twice. Assigning would discard the first, so
  // groups merge and only tokens are replaced. Last token wins, which is the
  // order the caller listed them in. The merge is deep: a second `color`
  // carrying one neutral step must not discard the nine the first one wrote.
  if (
    node.kind === "group" &&
    typeof existing === "object" && existing !== null &&
    !Array.isArray(existing)
  ) {
    deepMerge(existing as Record<string, unknown>, nodeToJson(node));
    return;
  }
  level[node.name] = nodeToJson(node);
}

/**
 * Merge serialized groups: plain objects recurse, tokens replace.
 *
 * A serialized token carries `$value`; anything without one is a group the
 * walk created, and groups from two trees combine. Last token wins, so an
 * override lands over the scaffold's placeholder without taking the steps
 * beside it.
 */
function deepMerge(
  into: Record<string, unknown>,
  from: unknown,
): void {
  if (typeof from !== "object" || from === null || Array.isArray(from)) return;
  for (const [key, value] of Object.entries(from as Record<string, unknown>)) {
    const current = into[key];
    if (
      typeof current === "object" && current !== null &&
      !Array.isArray(current) &&
      typeof value === "object" && value !== null && !Array.isArray(value) &&
      (value as Record<string, unknown>)["$value"] === undefined
    ) {
      deepMerge(current as Record<string, unknown>, value);
    } else {
      into[key] = value;
    }
  }
}

/**
 * The fields one composite typography tuple carries, in the order it states
 * them. Kept beside the parser's own list rather than imported from it, so
 * the two forms agree by test rather than by sharing a private constant.
 */
const STYLE_FIELDS: readonly string[] = [
  "family",
  "size",
  "weight",
  "tracking",
  "leading",
];

/**
 * Whether a group is a serialized style tuple: a group under
 * `font.style.<name>` whose children are exactly the five style leaves.
 * Composite tuples and five-child groups normalize to the same tree, so the
 * serializer writes the compact form back whatever form authored it.
 */
function isStyleTuple(node: TokenGroup): boolean {
  if (node.kind !== "group" || node.path.length !== 3) return false;
  if (node.path[0] !== "font" || node.path[1] !== "style") return false;
  if (node.children.length !== STYLE_FIELDS.length) return false;
  return node.children.every((child, index) =>
    child.kind === "token" &&
    child.name === STYLE_FIELDS[index] &&
    child.path.length === 4 &&
    child.path[3] === STYLE_FIELDS[index]
  );
}

/**
 * Serialize one style tuple as the compact composite token: one
 * `$type: "typography"` carrying the five fields in a single `$value`. The
 * leaves' descriptions stay on the document's leaves no longer — the tuple
 * is the owned voice, and the tuple's own `$description` says what it is.
 */
function styleTupleToJson(node: TokenGroup): unknown {
  const value: Record<string, unknown> = {};
  for (const child of node.children) {
    if (child.kind !== "token") continue;
    value[child.name] = child.value;
  }
  const out: Record<string, unknown> = {
    $type: "typography",
  };
  if (node.description !== undefined) out.$description = node.description;
  out.$value = value;
  // A `$modes` the tuple's leaves share is the tuple's variation, stated
  // once beside the value rather than five times across it.
  const modes = node.children[0]?.kind === "token"
    ? node.children[0].modes
    : undefined;
  if (
    modes !== undefined &&
    node.children.every((child) =>
      child.kind === "token" &&
      JSON.stringify(child.modes) === JSON.stringify(modes)
    )
  ) {
    out.$modes = modes;
  }
  return out;
}

function nodeToJson(node: TokenNode): unknown {
  if (node.kind === "token") {
    const out: Record<string, unknown> = {
      $type: node.type,
      $value: node.value,
    };
    if (node.modes !== undefined) out.$modes = node.modes;
    if (node.description !== undefined) out.$description = node.description;
    return out;
  }
  // A style tuple round-trips as the compact composite whatever form
  // authored it: the parser expands the composite to these same leaves,
  // so serializing the leaves back as five children would grow every file
  // the parser touched.
  if (isStyleTuple(node)) return styleTupleToJson(node);
  const out: Record<string, unknown> = {};
  if (node.type !== undefined) out.$type = node.type;
  for (const child of node.children) {
    // Children nest by their full path relative to the group, so a leaf at
    // `color.semantic.success` lands three deep even when the tree holds it
    // flat under `color`. The path is the only structure trusted here.
    const rel = child.path.slice(node.path.length);
    const segments = rel.length > 0 ? rel : [child.name];
    let level = out;
    for (const segment of segments.slice(0, -1)) {
      const next = level[segment];
      if (typeof next !== "object" || next === null || Array.isArray(next)) {
        const fresh: Record<string, unknown> = {};
        level[segment] = fresh;
        level = fresh;
      } else {
        level = next as Record<string, unknown>;
      }
    }
    level[segments[segments.length - 1] as string] = nodeToJson(child);
  }
  return out;
}
