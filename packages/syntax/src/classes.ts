/** The class strings a markup file names.
 *
 * A class attribute is static text or an expression. A static one names
 * its utilities outright. An expression names them in its string
 * literals — `class={"bg-surface" + (slider.dragging ? " scale-110" : "")}`
 * names two — and the vocabulary check has to see through it, or a
 * misspelled utility in a dynamic class is a dead rule nobody catches.
 *
 * The literals are collected, not evaluated: an expression's shape is not
 * the compiler's business, only which utilities it names.
 */

import type { Attr, AttrValue, ComponentIr, Node } from "./ir.ts";
import { expandVariantGroups } from "./expand-groups.ts";

/** The string literals an expression holds. */
function literalsOf(expression: string): string[] {
  const out: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|`([^`]*)`/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(expression)) !== null) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value !== undefined && value.length > 0) out.push(value);
  }
  return out;
}

/** The class tokens an attribute names. A variant group is one token
 * that names several (`data-[open]:(bg-x text-y)`), so the groups are
 * expanded before the tokens are split. */
export function classTokensOf(value: AttrValue): string[] {
  const out: string[] = [];
  const push = (text: string): void => {
    for (const token of expandVariantGroups(text).split(/\s+/)) {
      if (token.length > 0) out.push(token);
    }
  };
  if (value.kind === "static") {
    push(value.value);
    return out;
  }
  // A class OBJECT: its keys are the classes, and its values are the
  // conditions. A literal in a value is not a class.
  if (/^\s*\{/.test(value.expr)) {
    for (const key of objectKeysOf(value.expr)) push(key);
    return out;
  }
  for (const literal of literalsOf(value.expr)) push(literal);
  return out;
}

/** The keys of an object literal, at its top level. */
function objectKeysOf(literal: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  const body = literal.trim().replace(/^\{/, "").replace(/\}$/, "");
  for (let i = 0; i <= body.length; i++) {
    const ch = body[i];
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    else if ((ch === "," && depth === 0) || i === body.length) {
      const entry = body.slice(start, i).trim();
      start = i + 1;
      if (entry.length === 0) continue;
      const colon = entry.indexOf(":");
      const key = (colon < 0 ? entry : entry.slice(0, colon)).trim();
      const name = /^"([^"]*)"$|^'([^']*)'$/.exec(key);
      if (name !== null) out.push(name[1] ?? name[2] ?? "");
    }
  }
  return out.filter((name) => name.length > 0);
}

/** Every class token a node names, in the document's order. */
function tokensOfNode(node: Node, out: string[]): void {
  if (node.kind === "text") {
    // A text expression is content, not a class: `{getChannelValue("hue")}`
    // names a channel, not a utility.
    return;
  }
  if (node.kind === "for") {
    for (const child of node.body) tokensOfNode(child, out);
    return;
  }
  for (const attr of node.attrs) {
    if (attr.name !== "class") continue;
    for (const token of classTokensOf(attr.value)) out.push(token);
  }
  for (const child of node.children) tokensOfNode(child, out);
}

/** Every class token the markup names. */
export function classTokens(ir: ComponentIr): string[] {
  const out: string[] = [];
  for (const node of ir.nodes) tokensOfNode(node, out);
  return out;
}

/** The class attribute of a node, if it has one. */
export function classAttrOf(node: Extract<Node, { kind: "element" }>): Attr | undefined {
  return node.attrs.find((attr) => attr.name === "class");
}
