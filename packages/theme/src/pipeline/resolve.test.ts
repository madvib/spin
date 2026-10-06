import { assert, assertEquals } from "@std/assert";
import {
  aliasTarget,
  cssVarName,
  detectCycles,
  indexTree,
  isAliasValue,
  lookupNode,
  resolveAliases,
} from "./resolve.ts";
import { parseTokens } from "./parse.ts";
import type { TokenTree } from "./types.ts";

/**
 * The resolve stage's own surface.
 *
 * `resolveAliases` is exercised heavily elsewhere; these are the four helpers it
 * is built from, each of which is exported and therefore part of what the module
 * promises. A helper that is public but only ever tested through its caller is
 * a helper whose contract has never been stated.
 */

Deno.test("cssVarName joins a token path into a custom property", () => {
  assertEquals(cssVarName(["color", "primary"]), "--color-primary");
  assertEquals(
    cssVarName(["color", "semantic", "error"]),
    "--color-semantic-error",
  );
  assertEquals(cssVarName(["z-index", "dropdown"]), "--z-index-dropdown");
});

Deno.test("isAliasValue recognises the reference form and nothing else", () => {
  assert(isAliasValue("{color.primary}"));
  assert(isAliasValue("{color.semantic.error}"));
  assert(!isAliasValue("#ff0000"), "a hex literal is a value");
  assert(!isAliasValue("1rem"), "a dimension is a value");
  assert(!isAliasValue("{}"), "an empty reference names nothing");
  assert(!isAliasValue(42), "only strings can be references");
});

Deno.test("aliasTarget extracts the path, or null when there is none", () => {
  assertEquals(aliasTarget("{color.primary}"), "color.primary");
  assertEquals(aliasTarget("{color.semantic.error}"), "color.semantic.error");
  assertEquals(aliasTarget("#ff0000"), null);
});

Deno.test("lookupNode resolves a dotted path against an index", () => {
  const parsed = parseTokens({
    color: { $type: "color", primary: { $value: "#333" } },
  });
  if (!parsed.ok) throw new Error(parsed.error);
  const index = indexTree(parsed.tree);

  const leaf = lookupNode(index, "color.primary");
  assertEquals(leaf?.kind, "token");

  const group = lookupNode(index, "color");
  assertEquals(group?.kind, "group");

  assertEquals(lookupNode(index, "color.absent"), null);
  assertEquals(lookupNode(index, "absent"), null);
});

Deno.test("detectCycles names each cycle by its DTCG path", () => {
  const direct = parseTokens({
    a: { $type: "color", $value: "{b}" },
    b: { $type: "color", $value: "{a}" },
  });
  if (!direct.ok) throw new Error(direct.error);
  const cycles = detectCycles(direct.tree);
  assertEquals(cycles.length, 1, "one cycle");
  assert(cycles[0]?.includes("a"), JSON.stringify(cycles));
  assert(cycles[0]?.includes("b"), JSON.stringify(cycles));

  const self = parseTokens({ a: { $type: "color", $value: "{a}" } });
  if (!self.ok) throw new Error(self.error);
  assertEquals(
    detectCycles(self.tree).length,
    1,
    "a token aliasing itself is a cycle",
  );

  const acyclic = parseTokens({
    a: { $type: "color", $value: "#111" },
    b: { $type: "color", $value: "{a}" },
  });
  if (!acyclic.ok) throw new Error(acyclic.error);
  assertEquals(detectCycles(acyclic.tree), []);
});

Deno.test("resolveAliases inlines a reference and reports no cycles or unresolved references", () => {
  const parsed = parseTokens({
    base: { $type: "color", $value: "#333333" },
    primary: { $type: "color", $value: "{base}" },
  });
  if (!parsed.ok) throw new Error(parsed.error);
  const resolved = resolveAliases(parsed.tree);
  const index = indexTree(resolved.tree);
  assertEquals(index.leaves["primary"]?.value, "#333333");
  assertEquals(resolved.unresolved, []);
  assertEquals(resolved.cycles, [], "an acyclic document has no cycles");
});

Deno.test("an unresolvable reference is reported, not silently dropped", () => {
  const parsed = parseTokens({
    primary: { $type: "color", $value: "{color.absent}" },
  });
  if (!parsed.ok) throw new Error(parsed.error);
  const resolved = resolveAliases(parsed.tree);
  assertEquals(resolved.unresolved.length, 1);
  assert(resolved.unresolved[0]?.includes("primary"));
});

Deno.test("a cycle is reported once however many tokens feed it", () => {
  const parsed = parseTokens({
    a: { $type: "color", $value: "{b}" },
    b: { $type: "color", $value: "{c}" },
    c: { $type: "color", $value: "{a}" },
    also: { $type: "color", $value: "{a}" },
  });
  if (!parsed.ok) throw new Error(parsed.error);
  const resolved = resolveAliases(parsed.tree);
  assert(
    resolved.cycles.length === 1,
    `one cycle, got ${JSON.stringify(resolved.cycles)}`,
  );
});

Deno.test("the index exposes leaves by both path and custom property", () => {
  const parsed = parseTokens({
    color: { $type: "color", semantic: { error: { $value: "#b42318" } } },
  });
  if (!parsed.ok) throw new Error(parsed.error);
  const index = indexTree(parsed.tree as TokenTree);
  assert(
    index.leaves["color.semantic.error"],
    "leaves are keyed by dotted path",
  );
  // The var map is keyed by the emitted name without its `--` prefix, and
  // resolves to the same leaf the dotted lookup does.
  const byVar = index.vars["color-semantic-error"];
  assert(byVar, "vars are keyed by the emitted name");
  assertEquals(byVar.path, ["color", "semantic", "error"]);
  assertEquals(byVar, index.leaves["color.semantic.error"]);
  assertEquals(
    cssVarName(byVar.path),
    "--color-semantic-error",
    "the key is the stylesheet name minus its prefix",
  );
});
