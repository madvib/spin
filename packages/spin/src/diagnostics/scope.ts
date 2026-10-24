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
  readonly name?: { name?: string } | null;
  readonly parent?: ChainNode | null;
  readonly openingElement?: ChainNode;
  readonly attributes?: readonly ChainAttribute[];
}

/** One attribute of an element. */
export interface ChainAttribute {
  readonly type: string;
  readonly name?: { name?: string } | null;
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
    if (current.type === "JSXElement") {
      if (own) {
        // The element the node belongs to. The chain starts above it.
        own = false;
      } else {
        const opening = current.openingElement;
        if (opening !== undefined) {
          out.push({
            tag: opening.name?.name,
            classes: classesOf(opening),
          });
        }
      }
    }
    current = current.parent;
  }
  return out;
}

/**
 * The classes an element carries.
 *
 * A class list is a literal, and only a literal: a computed one is the
 * author's own arithmetic, and reading it would be guessing.
 */
function classesOf(element: ChainNode): string[] {
  for (const attribute of element.attributes ?? []) {
    const name = attribute.name?.name;
    if (name !== "class" && name !== "className") continue;
    const value = attribute.value;
    if (typeof value !== "object" || value === null) continue;
    const text = (value as { value?: unknown }).value;
    if (typeof text !== "string") continue;
    return text.split(/\s+/).filter(Boolean);
  }
  return [];
}
