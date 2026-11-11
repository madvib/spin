/**
 * The per-element token groups: the decisions a theme owns for ONE element.
 *
 * A shared scale is a decision the whole system shares — spacing, type,
 * radius, shadow. A per-element group is a decision the ELEMENT owns: the
 * card's corner, the alert's air, the field's edge, the number a stat shows,
 * the rule under a table row, the underline under a link. They exist so a
 * primitive can be styled independently of the scales it otherwise wears,
 * and they are supported only where that independence means something: a
 * group nothing spends is a lie, and a token that restates a scale step is a
 * second name for it.
 *
 * Each declaration carries the path, the type, the value a language
 * states, the documentation an editor shows, and the GLOBAL path a theme
 * falls back to when it omits this one. The fallback is what makes a group
 * safe to leave out: a theme that says nothing about the card's corner gets
 * the system's answer — the page's radius — and never the browser's.
 *
 * The groups are optional. A theme may declare none of them and still be a
 * complete theme; the primitives fall back to the shared scales, and the
 * stylesheet says which one it spent. A language states all of them,
 * because a language is the document an author reads, and an author should
 * be shown the decisions rather than the gaps.
 */

import primitives from "../base/primitives.json" with { type: "json" };
import elements from "../base/elements.json" with { type: "json" };
import reference from "../base/reference.json" with { type: "json" };
import { aliasTarget } from "../pipeline/resolve.ts";
import { asRecord } from "../json.ts";
import type { TokenType } from "../pipeline/types.ts";

/** One thing an element owns, and everything a language states for it. */
export interface ElementDeclaration {
  /** The group the token lives in — `card`, `alert`, `field`. */
  readonly group: string;
  /** The element that spends it. The same name as the group, always. */
  readonly element: string;
  /** The dotted path, e.g. `card.radius`. */
  readonly path: string;
  readonly type: TokenType;
  /**
   * What a language states. Valid, legible, and a finished look.
   *
   * A literal, never an alias: the value is what the primitive wears when
   */
  readonly value: string | number | boolean;
  readonly doc: string;
  /**
   * The global path a theme falls back to when it omits this token.
   *
   * Absent when there is no global answer to fall back to: the browser's own
   * default is the right answer for a case, a tracking and a resting
   * elevation, and the element's own ladder is the only answer for a size.
   */
  readonly fallback?: string;
}

/** One scalar leaf the documents state: its path, raw value, type, and doc. */
interface ScalarLeaf {
  readonly path: string[];
  readonly value: unknown;
  readonly type: TokenType;
  readonly doc: string;
}

/**
 * The scalar leaves of the named groups: every non-typography `$value` below
 * them, in the order the document states them. Typography tuples are the
 * owned styles, not per-element decisions, so they are skipped here.
 */
function scalarLeaves(doc: unknown, groups: readonly string[]): ScalarLeaf[] {
  const out: ScalarLeaf[] = [];
  const root = asRecord(doc) ?? {};
  for (const group of groups) {
    const top = asRecord(root[group]);
    if (top === undefined) continue;
    walkScalar(top, [group], undefined, docOf(top), out);
  }
  return out;
}

/** The `$description` a raw node states, when it states one. */
function docOf(node: Record<string, unknown>): string | undefined {
  return typeof node.$description === "string" ? node.$description : undefined;
}

/** Depth-first: groups recurse with their `$type`, scalar leaves collect. */
function walkScalar(
  node: Record<string, unknown>,
  path: string[],
  inherited: TokenType | undefined,
  groupDoc: string | undefined,
  out: ScalarLeaf[],
): void {
  const type = typeof node.$type === "string"
    ? (node.$type as TokenType)
    : inherited;
  if (Object.hasOwn(node, "$value")) {
    if (type !== undefined && type !== "typography") {
      out.push({
        path,
        value: node.$value,
        type,
        doc: docOf(node) ?? groupDoc ?? path.join("."),
      });
    }
    return;
  }
  for (const key of Object.keys(node)) {
    if (key.startsWith("$")) continue;
    const child = asRecord(node[key]);
    if (child === undefined) continue;
    walkScalar(child, [...path, key], type, groupDoc, out);
  }
}

/**
  * Language literals for alias targets the reference scales do not state.
  *
  * Ink and elevation live in the languages, not the reference — so an alias
  * into them resolves to the value the language states instead.
  */
const LANGUAGE_LITERALS: Record<string, string> = {
  "color.border": "#e5e5e5",
  "color.border-strong": "#999999",
  "color.surface-sunken": "#f0f0f0",
};

/** Follow an alias target through the reference scales to its literal. */
function resolveReference(
  target: string,
): string | number | boolean | undefined {
  let current: string | undefined = target;
  for (let hop = 0; hop < 8 && current !== undefined; hop += 1) {
    let node: unknown = reference;
    for (const segment of current.split(".")) {
      const record = asRecord(node);
      if (record === undefined) {
        node = undefined;
        break;
      }
      node = record[segment];
    }
    const value = asRecord(node)?.$value;
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      return undefined;
    }
    const next = aliasTarget(value);
    if (next === null) return value;
    current = next;
  }
  return undefined;
}

/**
  * The literal a language states for a raw `$value`.
  *
  * Aliases resolve against the reference scales; ink and elevation aliases
  * resolve to the literals above. A literal arrives as written, except a
  * shadow literal rests at `none` — the languages state no ladder to spend.
  */
function languageValue(
  type: TokenType,
  raw: unknown,
): string | number | boolean {
  const target = aliasTarget(raw);
  if (target === null) {
    if (type === "shadow") return "none";
    if (
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean"
    ) {
      return raw;
    }
    throw new Error(`contract: no language literal for ${JSON.stringify(raw)}`);
  }
  if (type === "shadow" || target.startsWith("shadow.")) return "none";
  const literal = LANGUAGE_LITERALS[target] ?? resolveReference(target);
  if (literal !== undefined) return literal;
  throw new Error(
    `contract: element token aliases an unknown target {${target}}`,
  );
}

/**
 * The per-element groups, one entry per token.
 *
 * Derived from the DTCG the system ships rather than remembered here: the
 * scalar leaves of the primitive groups, the reference icon ladder, and the
 * link's own rule, in the order the documents state them. A group is here
 * because a primitive spends it — the element's own decision, and only that.
 */
export const ELEMENT_ROLES: readonly ElementDeclaration[] = [
  ...scalarLeaves(primitives, [
    "badge",
    "button",
    "checkbox",
    "switch",
    "card",
    "alert",
    "field",
    "table",
  ]),
  ...scalarLeaves(reference, ["icon"]),
  ...scalarLeaves(elements, ["link"]),
].map((leaf) => {
  const target = aliasTarget(leaf.value);
  return {
    group: leaf.path[0] as string,
    element: leaf.path[0] as string,
    path: leaf.path.join("."),
    type: leaf.type,
    value: languageValue(leaf.type, leaf.value),
    doc: leaf.doc,
    ...(target === null ? {} : { fallback: target }),
  };
});

/** The paths of every per-element token. */
export function elementPaths(): readonly string[] {
  return ELEMENT_ROLES.map((role) => role.path);
}

