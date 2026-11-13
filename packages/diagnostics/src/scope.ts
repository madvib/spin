/**
 * The chain of elements above the one being read.
 *
 * A primitive's scope is a PLACE, and a place is a chain: an element is
 * inside a document column only if the column is above it. The three front
 * ends all carry the chain — oxlint's plugin API sets `parent` on every node
 * it walks, ESLint's own traverser does the same, and the CLI's walk sets it
 * as it goes — so the chain is read the same way everywhere.
 *
 * The shape of a node is written out rather than imported, so this file
 * depends on no linter and no adapter: it reads the tree, and the tree is
 * the same tree everywhere.
 */

import type { AncestorFacts } from "./core.ts";

/**
 * A node, as far as the chain reads it.
 *
 * Only the fields the chain looks at are named: the node's kind, the link to
 * the node that holds it, and — for an element — the opening tag that names
 * it and carries its attributes.
 */
export interface ChainNode {
  readonly type: string;
  readonly name?: { name?: string } | string | null;
  readonly key?: { name?: string | { name?: string }; value?: string } | null;
  readonly parent?: ChainNode | null;
  readonly openingElement?: ChainNode;
  readonly startTag?: ChainNode;
  readonly attributes?: readonly ChainAttribute[];
}

/** One attribute of an element. */
export interface ChainAttribute {
  readonly type: string;
  readonly name?: { name?: string } | string | null;
  readonly key?: { name?: string | { name?: string }; value?: string } | null;
  readonly value?: unknown;
}

/**
 * The elements above a node, nearest first.
 *
 * Only the elements are listed: a function or a return statement is not a
 * place a primitive paints, and the chain of a document is made of elements.
 *
 * The element the node BELONGS to is not one of them: the chain starts
 * above it, because the element's own tag and classes are read where the
 * attribute is.
 */
export function ancestorsOf(node: ChainNode): AncestorFacts[] {
  const out: AncestorFacts[] = [];
  let current = node.parent;
  let own = true;
  while (current !== undefined && current !== null) {
    const element = elementAt(current);
    if (element !== undefined) {
      if (own) {
        // The element the node belongs to. The chain starts above it.
        own = false;
      } else {
        out.push({ tag: tagName(element), classes: classesOf(element) });
      }
    }
    current = current.parent;
  }
  return out;
}

/** The element a chain link is, when it is one. */
function elementAt(node: ChainNode): ChainNode | undefined {
  switch (node.type) {
    case "JSXElement":
      return node.openingElement;
    case "VElement":
    case "SvelteElement":
      return node.startTag;
    case "Tag":
      return node;
    default:
      return undefined;
  }
}

/** The tag name an element link carries. */
function tagName(element: ChainNode): string | undefined {
  if (element.type === "VElement" || element.type === "Tag") {
    return typeof element.name === "string" ? element.name : undefined;
  }
  const name = element.name;
  if (typeof name === "string") return name;
  if (typeof name === "object" && name !== null) return name.name;
  if (element.type === "VStartTag" || element.type === "SvelteStartTag") {
    const parent = element.parent;
    if (parent !== undefined && parent !== null) return tagName(parent);
  }
  return undefined;
}

/**
 * The classes an element carries.
 *
 * A class list is a literal, and only a literal: a computed one is the
 * author's own arithmetic, and reading it would be guessing.
 */
function classesOf(element: ChainNode): string[] {
  for (const attribute of element.attributes ?? []) {
    if (!isClassName(attribute)) continue;
    const text = staticText(attribute.value);
    if (text === undefined) continue;
    return text.split(/\s+/).filter(Boolean);
  }
  return [];
}

/** Whether an attribute names the element's class list. */
function isClassName(attribute: ChainAttribute): boolean {
  const name = attribute.name;
  if (typeof name === "string") return name === "class" || name === "className";
  if (typeof name === "object" && name !== null && (name.name === "class" || name.name === "className")) {
    return true;
  }
  const key = attribute.key;
  if (typeof key?.value === "string") return key.value === "class";
  if (typeof key?.name === "string") return key.name === "class";
  return false;
}

/** The string a class value carries, when it carries one literally. */
function staticText(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    if (value.length !== 1) return undefined;
    const part = value[0] as { type?: unknown; value?: unknown } | undefined;
    if (part?.type !== "SvelteLiteral") return undefined;
    return typeof part.value === "string" ? part.value : undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const text = (value as { value?: unknown }).value;
  return typeof text === "string" ? text : undefined;
}
