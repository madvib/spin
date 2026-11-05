import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  FACE_CHAINS,
  styleFloorNames,
  indexTree,
  parseTokens,
  requiredPaths,
  resolveAliases,
  themeSchema,
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
    const entry = style[name as string]?.[field as string];
    if (entry === undefined) continue;
    entry["$value"] = leaf.value;
  }
  delete (font as Record<string, unknown>)["size"];
  delete (font as Record<string, unknown>)["weight"];
  delete (font as Record<string, unknown>)["tracking"];
  delete (font as Record<string, unknown>)["leading"];
}


test("every starter implements the floor names", () => {
  // The floor is the styles a theme must declare: every starter implements
  // every name, and the names are the contract's own list rather than a
  // roster written down here.
  for (const [theme, doc] of Object.entries(starterThemes)) {
    const font = doc["font"] as Record<string, unknown>;
    const style = font["style"] as Record<string, unknown>;
    for (const name of styleFloorNames()) {
      assert(
        style[name] !== undefined,
        `${theme}: the starter must implement the ${name} style`,
      );
    }
  }
});

test("trimming below the floor fails completeness", () => {
  // The names are stable API: a theme that drops one breaks every consumer
  // of that name, so the gate reports the missing tuple at its own leaves.
  const doc = structuredClone(starterThemes.silk) as Record<string, unknown>;
  const style = (doc["font"] as Record<string, unknown>)[
    "style"
  ] as Record<string, unknown>;
  const name = styleFloorNames()[0] as string;
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
  const doc = structuredClone(starterThemes.silk) as Record<string, unknown>;
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
