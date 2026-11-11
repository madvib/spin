import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  ownedStyleFields,
  ownedStyleNames,
  indexTree,
  parseTokens,
  requiredPaths,
  resolveAliases,
  validateTokens,
} from "../index.ts";
import { starterThemes } from "../themes/index.ts";
import type { ThemeDocument, TokenLeaf } from "../pipeline/types.ts";

/**
 * A theme whose styles carry literals and that states no type scales.
 *
 * Each style leaf's alias is replaced by the value it points at, and the
 * scale groups the aliases pointed into are dropped. The document keeps its
 * shape — the same styles, the same leaves — so the check answers whether
 * the styles alone carry the theme, never whether a reshaped document does.
 */
function inlineStyleLiterals(doc: ThemeDocument): void {
  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  const resolved = indexTree(resolveAliases(parsed.tree).tree).leaves;
  const font = doc["font"] as Record<string, Record<string, Record<string, Record<string, unknown>>>>;
  const style = font["style"] as Record<string, Record<string, Record<string, unknown>>>;
  for (const leaf of Object.values(resolved) as TokenLeaf[]) {
    const [root, group, name, field] = leaf.path;
    if (root !== "font" || group !== "style") continue;
    const entry = style[name as string];
    if (entry === undefined) continue;
    // Composite form nests fields inside one `$value`; group form nests a
    // leaf per field. Either way the literal lands where the parser reads.
    const tuple = (entry as Record<string, unknown>)["$value"];
    if (typeof tuple === "object" && tuple !== null) {
      (tuple as Record<string, unknown>)[field as string] = leaf.value;
      continue;
    }
    const child = (entry as Record<string, Record<string, unknown>>)[field as string];
    if (child === undefined) continue;
    child["$value"] = leaf.value;
  }
  delete (font as Record<string, unknown>)["size"];
  delete (font as Record<string, unknown>)["weight"];
  delete (font as Record<string, unknown>)["tracking"];
  delete (font as Record<string, unknown>)["leading"];
}


test("every starter implements the owned names", () => {
  // The owned set is the styles a theme must declare: every starter implements
  // every name, and the names are the contract's own list rather than a
  // roster written down here.
  for (const [theme, doc] of Object.entries(starterThemes)) {
    const font = doc["font"] as Record<string, unknown>;
    const style = font["style"] as Record<string, unknown>;
    for (const name of ownedStyleNames()) {
      assert(
        style[name] !== undefined,
        `${theme}: the starter must implement the ${name} style`,
      );
    }
  }
});

test("trimming below the owned set fails completeness", () => {
  // The names are stable API: a theme that drops one breaks every consumer
  // of that name, so the gate reports the missing tuple at its own leaves.
  const doc = structuredClone(starterThemes.minimal) as Record<string, unknown>;
  const style = (doc["font"] as Record<string, unknown>)[
    "style"
  ] as Record<string, unknown>;
  const name = ownedStyleNames()[0] as string;
  delete style[name];
  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, { required: requiredPaths() });
  assert(
    report.issues.some((issue) =>
      issue.path === `font.style.${name}.family` &&
      issue.message.startsWith("missing")
    ),
    `trimming ${name} must fail completeness: ${
      JSON.stringify(report.issues)
    }`,
  );
});

test("literal-valued styles with no type scales are complete", () => {
  // Scales are the style author's library, not a spend path: the type
  // scales stay out of the required paths, so a theme whose styles carry
  // literals and that states no type scale groups is complete.
  const doc = structuredClone(starterThemes.minimal) as Record<string, unknown>;
  inlineStyleLiterals(doc);
  const parsed = parseTokens(doc);
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, { required: requiredPaths() });
  deepStrictEqual(report.issues, []);
});

test("the type scales are not required paths", () => {
  // The flip, stated directly: no type scale step is something a theme
  // owes, so a gate built from the required paths never asks for one.
  const required = new Set(requiredPaths());
  for (
    const step of [
      "font.size.md",
      "font.weight.regular",
      "font.tracking.normal",
      "font.leading.relaxed",
    ]
  ) {
    assert(
      !required.has(step),
      `${step} must not be a required path: styles carry the tuple`,
    );
  }
});

/**
 * The style audit: no two declared styles may carry the same tuple.
 *
 * Two names over one tuple are one style with two names, and a theme that
 * keeps both invites the second guess every re-point has to rule out. The
 * check reads the resolved tuple — the alias targets, not the alias text —
 * so two styles built from the same steps fail even when they spell the
 * steps the same way.
 */
function resolvedStyleTuples(doc: ThemeDocument): Map<string, string> {
  const parsed = parseTokens(structuredClone(doc));
  if (!parsed.ok) throw new Error(parsed.error);
  const resolved = indexTree(resolveAliases(parsed.tree).tree).leaves;
  const leaves = new Map<string, string>();
  for (const leaf of Object.values(resolved) as TokenLeaf[]) {
    const [root, group, name, field] = leaf.path;
    if (root !== "font" || group !== "style") continue;
    leaves.set(`${name as string}.${field as string}`, String(leaf.value));
  }
  const tuples = new Map<string, string>();
  for (const name of ownedStyleNames()) {
    tuples.set(
      name,
      ownedStyleFields().map((field) => leaves.get(`${name}.${field}`)).join("|"),
    );
  }
  return tuples;
}

test("no two styles share a tuple", () => {
  for (const [theme, doc] of Object.entries(starterThemes)) {
    const seen = new Map<string, string>();
    for (const [name, tuple] of resolvedStyleTuples(doc)) {
      const other = seen.get(tuple);
      assert(
        other === undefined,
        `${theme}: ${name} carries the ${other} tuple — one tuple, one name`,
      );
      seen.set(tuple, name);
    }
  }
});

test("starters disagree: at least two themes differ per style", () => {
  // The starters are five directions, not five copies: a style that reads
  // the same everywhere is a style no starter owns. Two differing tuples
  // per style keeps the set honest without pinning which theme differs.
  for (const name of ownedStyleNames()) {
    const tuples = new Set(
      Object.values(starterThemes).map((doc) => resolvedStyleTuples(doc).get(name)),
    );
    assert(
      tuples.size >= 2,
      `${name} reads the same in every starter — a style no starter owns`,
    );
  }
});

test("the owned set is thirteen styles with no link", () => {
  deepStrictEqual([...ownedStyleNames()], [
    "display",
    "title",
    "heading",
    "subtitle",
    "lead",
    "body",
    "quote",
    "code",
    "label",
    "caption",
    "overline",
    "body-emphasized",
    "caption-emphasized",
  ]);
});

