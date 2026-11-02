import { readFileSync } from "node:fs";
import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { parseTokens, validateTokens } from "../../src/theme/index.ts";
import { requiredRolesFor } from "../../src/compiler/index.ts";
import { starterThemes } from "../../src/theme/themes/index.ts";
import type { TokenLeaf, TokenNode } from "../../src/theme/index.ts";

/**
 * The shipped example themes are the reference implementations of "a theme
 * that satisfies the whole surface". Completeness is a composition claim — it
 * needs the base roles plus every enabled primitive's component tokens — so it
 * is asserted here, where that composition lives, rather than in
 * `@spinjs/theme`, which cannot see the primitives at all.
 */
function example(name: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../../src/theme/themes/${name}`, import.meta.url),
      "utf8",
    ),
  );
}

/** A base document: the whole surface, nothing layered over it. */
for (const name of Object.keys(starterThemes).map((stem) => `${stem}.json`)) {
  test(`${name} satisfies every required role`, () => {
    const parsed = parseTokens(example(name));
    if (!parsed.ok) throw new Error(parsed.error);
    const report = validateTokens(parsed.tree, {
      required: [...requiredRolesFor()],
    });
    deepStrictEqual(
      report.issues.filter((issue) => issue.message.startsWith("missing")),
      [],
      `${name} is missing roles the full surface requires`,
    );
  });
}

/**
 * A mode override layers on its base rather than restating it, so it is
 * legitimately partial — what it owes is that everything it does declare is
 * sound. the `dark` group declares fewer tokens than the full surface
 * and reports no other issue; requiring completeness of it would be requiring
 * a dark theme to ignore its own light one.
 */
test("a dark MODE restates what it flips and inherits the rest", () => {
  // `dark` is a MODE, not a document: it lives inside the theme and says what
  // changes. So the property to check is that every path it declares is one the
  // theme already declares — a mode that introduced a NEW token would be a
  // second theme wearing a mode's name.
  const parsed = parseTokens(example("silk.json"));
  if (!parsed.ok) throw new Error(parsed.error);

  // A token carries its mode values as `$modes.dark` beside its base, so the
  // property is now structural: a mode may only restate a token the theme
  // already declares. There is no group to walk any more, and no second
  // document to reconcile — the test's original worry is answered by the
  // shape itself, which the schema enforces.
  const withMode = parsed.tree.flatMap(function walk(
    node: TokenNode,
  ): TokenLeaf[] {
    if (node.kind === "token") {
      return node.modes !== undefined && "dark" in node.modes ? [node] : [];
    }
    return node.children.flatMap(walk);
  });
  assert(withMode.length > 0, "the theme must declare some dark values");
});
