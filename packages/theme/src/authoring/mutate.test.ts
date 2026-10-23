import { assert, assertEquals } from "@std/assert";
import type { MutationResult } from "./mutate.ts";
import { parseTokens } from "../pipeline/parse.ts";
import { validateTokens } from "../pipeline/validate.ts";
import { scaffoldTheme } from "./scaffold.ts";
import { removeToken, renameToken, setToken, treeToJson } from "./mutate.ts";
import { requiredPaths } from "../contract/roles.ts";
import { indexTree } from "../pipeline/resolve.ts";

function treeOf(text: string) {
  const parsed = parseTokens(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.tree;
}

Deno.test("setToken updates the value of an existing token", () => {
  const result = setToken(scaffoldTheme(), ["color", "primary"], "#ff0000");
  assert(result.ok, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) return;
  const round = parseTokens(treeToJson(result.tree));
  assert(round.ok, `round-trip must parse: ${JSON.stringify(round)}`);
});

Deno.test("setToken refuses a $type change on an existing token", () => {
  const result = setToken(
    scaffoldTheme(),
    ["color", "primary"],
    "1px",
    "dimension",
  );
  assert(!result.ok, "expected a type-mismatch error");
  assertEquals(result.code, "type-mismatch");
  assertEquals(result.path, "color.primary", "the refusal names the token");
});

Deno.test("setToken creates a token and its missing parents with a $type", () => {
  const result = setToken(
    scaffoldTheme(),
    ["color", "brand", "hot"],
    "#ff0000",
    "color",
  );
  assert(result.ok, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) return;
  const round = parseTokens(treeToJson(result.tree));
  assert(round.ok, `created token must round-trip: ${JSON.stringify(round)}`);
});

Deno.test("setToken refuses to create a token without a $type", () => {
  const result = setToken(scaffoldTheme(), ["color", "brand"], "#ff0000");
  assert(!result.ok, "expected a missing-$type error");
});

Deno.test("setToken refuses to overwrite a group", () => {
  const result = setToken(scaffoldTheme(), ["color"], "#ff0000", "color");
  assert(!result.ok, "expected a group-collision error");
});

Deno.test("removeToken deletes the token and the tree still validates", () => {
  const start = treeOf(
    JSON.stringify({
      color: {
        $type: "color",
        primary: { $value: "#111111" },
        extra: { $value: "#222222" },
      },
    }),
  );
  const result = removeToken(start, ["color", "extra"]);
  assert(result.ok, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) return;
  const round = parseTokens(treeToJson(result.tree));
  assert(round.ok, "tree without the token must still parse");
});

Deno.test("removeToken reports a missing token and refuses groups", () => {
  const tree = scaffoldTheme();
  const missing = removeToken(tree, ["color", "nope"]);
  assert(!missing.ok, "expected a missing-token error");
  const group = removeToken(tree, ["color"]);
  assert(!group.ok, "expected a group refusal");
});

Deno.test("renameToken moves the token with its $type intact", () => {
  const result = renameToken(scaffoldTheme(), ["color", "primary"], [
    "color",
    "brand",
  ]);
  assert(result.ok, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) return;
  const round = parseTokens(treeToJson(result.tree));
  assert(round.ok, `renamed tree must parse: ${JSON.stringify(round)}`);
  if (!round.ok) return;
  const issues =
    validateTokens(round.tree, { required: requiredPaths() }).issues;
  assert(
    issues.some((issue) =>
      issue.path === "color.primary" && issue.message.startsWith("missing")
    ),
    `renaming color.primary must report it missing: ${JSON.stringify(issues)}`,
  );
  assert(
    !issues.some((issue) => issue.path === "color.brand"),
    `color.brand must be clean: ${JSON.stringify(issues)}`,
  );
});
Deno.test("renameToken refuses an occupied target", () => {
  const result = renameToken(
    scaffoldTheme(),
    ["color", "primary"],
    ["color", "secondary"],
  );
  assert(!result.ok, "expected an occupied-target error");
});

Deno.test("mutations never mutate the input tree", () => {
  const start = scaffoldTheme();
  const before = treeToJson(start);
  const ok = setToken(start, ["color", "primary"], "#ff0000");
  assert(ok.ok);
  assertEquals(treeToJson(start), before, "input tree is unchanged");
});

Deno.test("a refusal names its cause, its token, and its specifics", () => {
  const cases: Array<[string, MutationResult]> = [
    ["set on a group", setToken(scaffoldTheme(), ["color"], "#fff", "color")],
    ["remove what is absent", removeToken(scaffoldTheme(), ["color", "ghost"])],
    [
      "rename onto an occupied path",
      renameToken(
        scaffoldTheme(),
        ["color", "primary"],
        ["color", "secondary"],
      ),
    ],
    [
      "create without a type",
      setToken(scaffoldTheme(), ["color", "brand"], "#fff"),
    ],
  ];
  for (const [what, result] of cases) {
    assert(!result.ok, `${what} must be refused`);
    assert(result.code.length > 0, `${what} names a code`);
    assert(result.detail.length > 0, `${what} explains itself`);
  }
});

Deno.test("every refusal code is reachable from a public mutation", () => {
  // If a code is unreachable it is dead vocabulary: a client would branch on
  // something no operation can return.
  const observed = new Set<string>();
  const tree = () => scaffoldTheme();
  for (
    const result of [
      setToken(tree(), [], "x", "color"),
      setToken(tree(), ["color"], "x", "color"),
      setToken(tree(), ["color", "primary"], "x", "dimension"),
      setToken(tree(), ["color", "brand"], "x"),
      removeToken(tree(), ["color", "ghost"]),
      removeToken(tree(), ["color"]),
      renameToken(tree(), ["color", "ghost"], ["color", "x"]),
      renameToken(tree(), ["color"], ["color", "x"]),
      renameToken(tree(), ["color", "primary"], ["color", "secondary"]),
    ]
  ) {
    if (!result.ok) observed.add(result.code);
  }
  assertEquals([...observed].sort(), [
    "empty-path",
    "group-not-token",
    "missing-token",
    "occupied-target",
    "type-mismatch",
    "type-required",
  ]);
});

/**
 * `$modes` and the mutations.
 *
 * A shipped theme carries its dark values as `$modes.dark` beside each base
 * value, so any mutation that clones and serialises the tree must carry the
 * slots through untouched. The failure this guards is silent: the edit
 * succeeds, the file saves, and every dark value in the document is gone —
 * the theme builds, it is just light-only from then on.
 */
const MODED = JSON.stringify({
  color: {
    $type: "color",
    primary: { $value: "#111111", $modes: { dark: "#eeeeee" } },
    secondary: { $value: "#222222", $modes: { dark: "#dddddd" } },
  },
});

function leafAt(text: string, path: string) {
  const parsed = parseTokens(text);
  if (!parsed.ok) throw new Error(parsed.error);
  const node = indexTree(parsed.tree).nodes[path];
  if (node === undefined || node.kind !== "token") {
    throw new Error(`no token at ${path}`);
  }
  return node;
}

Deno.test("editing a base value keeps every $modes slot in the document", () => {
  const result = setToken(treeOf(MODED), ["color", "primary"], "#ff0000");
  assert(result.ok, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) return;
  const text = treeToJson(result.tree);
  assertEquals(leafAt(text, "color.primary").value, "#ff0000");
  assertEquals(leafAt(text, "color.primary").modes, { dark: "#eeeeee" });
  assertEquals(leafAt(text, "color.secondary").modes, { dark: "#dddddd" });
});

Deno.test("setToken writes a mode override beside an unchanged base value", () => {
  const result = setToken(
    treeOf(MODED),
    ["color", "primary"],
    "#aaaaaa",
    undefined,
    "dark",
  );
  assert(result.ok, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) return;
  const text = treeToJson(result.tree);
  assertEquals(leafAt(text, "color.primary").value, "#111111");
  assertEquals(leafAt(text, "color.primary").modes, { dark: "#aaaaaa" });
});

Deno.test("a mode value equal to the base is stored as no override", () => {
  const result = setToken(
    treeOf(MODED),
    ["color", "primary"],
    "#111111",
    undefined,
    "dark",
  );
  assert(result.ok, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) return;
  const text = treeToJson(result.tree);
  assertEquals(leafAt(text, "color.primary").modes, undefined);
  assertEquals(leafAt(text, "color.secondary").modes, { dark: "#dddddd" });
});

Deno.test("a mode override needs an existing token to override", () => {
  const result = setToken(
    treeOf(MODED),
    ["color", "tertiary"],
    "#ffffff",
    "color",
    "dark",
  );
  assert(!result.ok, "expected a missing-token refusal");
  assertEquals(result.code, "missing-token");
});

Deno.test("renameToken carries $modes to the new path", () => {
  const result = renameToken(treeOf(MODED), ["color", "primary"], [
    "color",
    "brand",
  ]);
  assert(result.ok, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) return;
  const text = treeToJson(result.tree);
  assertEquals(leafAt(text, "color.brand").modes, { dark: "#eeeeee" });
});
