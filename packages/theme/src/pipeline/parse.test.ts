import { assert, assertEquals } from "@std/assert";
import { parseTokens } from "./parse.ts";
import type { ParseResult, TokenGroup, TokenLeaf, TokenTree } from "./types.ts";

/** Every token in the tree, flattened out of the groups that hold them. */
function leaves(tree: TokenTree): TokenLeaf[] {
  const found: TokenLeaf[] = [];
  const walk = (nodes: TokenTree) => {
    for (const node of nodes) {
      if (node.kind === "token") found.push(node);
      else walk(node.children);
    }
  };
  walk(tree);
  return found;
}

/** Each token's dotted path and value, for comparing two whole trees. */
function leafValues(tree: TokenTree): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const leaf of leaves(tree)) {
    values[leaf.path.join(".")] = leaf.value;
  }
  return values;
}

/** The token at a dotted path, failing loudly when it is absent. */
function leafAt(tree: TokenTree, path: string): TokenLeaf {
  const found = leaves(tree).find((leaf) => leaf.path.join(".") === path);
  if (!found) {
    throw new Error(
      `no token at "${path}"; tree holds: ${
        leaves(tree).map((l) => l.path.join(".")).join(", ") || "(no tokens)"
      }`,
    );
  }
  return found;
}

/** The top-level group of a given name, failing loudly when it is absent. */
function groupAt(tree: TokenTree, name: string): TokenGroup {
  const found = tree.find(
    (node): node is TokenGroup => node.kind === "group" && node.name === name,
  );
  if (!found) {
    throw new Error(
      `no group named "${name}"; tree holds: ${
        tree.map((n) => n.name).join(", ") || "(empty)"
      }`,
    );
  }
  return found;
}

/** Unwraps a failed parse, failing loudly when the input actually parsed. */
function errorOf(result: ParseResult): string {
  if (result.ok) {
    throw new Error(
      `expected a parse failure, but a tree with ${result.tree.length} top-level group(s) was returned`,
    );
  }
  return result.error;
}

/** Unwraps a successful parse, failing loudly when the input was rejected. */
function treeOf(result: ParseResult): TokenTree {
  if (!result.ok) {
    throw new Error(
      `expected the input to parse, but it was rejected: ${result.error}`,
    );
  }
  return result.tree;
}

const LIGHT_TOKENS = {
  color: {
    brand: {
      $type: "color",
      $value: "#ff0000",
      $description: "Primary brand hue",
    },
    accent: { $type: "color", $value: "{color.brand}" },
  },
  space: {
    sm: { $type: "dimension", $value: "4px" },
  },
};

Deno.test("parseTokens accepts a DTCG document supplied as a JSON string", () => {
  const tree = treeOf(parseTokens(JSON.stringify(LIGHT_TOKENS)));

  assertEquals(leafAt(tree, "color.brand").type, "color");
  assertEquals(leafAt(tree, "color.brand").value, "#ff0000");
  assertEquals(leafAt(tree, "space.sm").value, "4px");
});

Deno.test("parseTokens yields the same tree for JSON text and for an already-decoded object", () => {
  const fromText = treeOf(parseTokens(JSON.stringify(LIGHT_TOKENS)));
  const fromObject = treeOf(parseTokens(structuredClone(LIGHT_TOKENS)));

  assertEquals(leafValues(fromObject), leafValues(fromText));
});

Deno.test("parseTokens exposes the dotted path of a token nested in several groups", () => {
  const tree = treeOf(parseTokens({
    color: { button: { primary: { $type: "color", $value: "#00ff00" } } },
  }));

  assertEquals(leafAt(tree, "color.button.primary").value, "#00ff00");
  assertEquals(leafAt(tree, "color.button.primary").path, [
    "color",
    "button",
    "primary",
  ]);
});

Deno.test("parseTokens keeps group nodes in the tree alongside their tokens", () => {
  const tree = treeOf(parseTokens(LIGHT_TOKENS));
  const color = groupAt(tree, "color");

  assertEquals(
    color.children.map((child) => child.name).sort(),
    ["accent", "brand"],
  );
});

Deno.test("parseTokens carries the $description onto the token", () => {
  const tree = treeOf(parseTokens(LIGHT_TOKENS));

  assertEquals(leafAt(tree, "color.brand").description, "Primary brand hue");
});

Deno.test("parseTokens preserves an alias value verbatim so it can be resolved later", () => {
  const tree = treeOf(parseTokens(LIGHT_TOKENS));

  assertEquals(leafAt(tree, "color.accent").value, "{color.brand}");
});

Deno.test("parseTokens lets a group-level $type stand in for its tokens", () => {
  const tree = treeOf(parseTokens({
    color: { $type: "color", brand: { $value: "#123456" } },
  }));

  assertEquals(leafAt(tree, "color.brand").type, "color");
});
Deno.test("parseTokens reports a document that declares no tokens", () => {
  const error = errorOf(parseTokens({}));

  assert(error.trim().length > 0, "the rejection must explain what went wrong");
});

Deno.test("parseTokens reports malformed JSON with a non-blank message", () => {
  const error = errorOf(parseTokens('{"color": '));

  assertEquals(typeof error, "string");
  assert(
    error.trim().length > 0,
    "a parse failure must explain what went wrong",
  );
});

Deno.test("parseTokens rejects a token that declares a $type but no $value", () => {
  const error = errorOf(parseTokens({ color: { brand: { $type: "color" } } }));

  assert(
    error.includes("brand"),
    `the error must name the offending token, got: ${error}`,
  );
});

Deno.test("parseTokens rejects a token that declares a $value but no $type", () => {
  const error = errorOf(
    parseTokens({ color: { brand: { $value: "#ff0000" } } }),
  );

  assert(
    error.includes("brand"),
    `the error must name the offending token, got: ${error}`,
  );
});

Deno.test("parseTokens rejects a document that mixes a valid group with a valueless one", () => {
  const error = errorOf(parseTokens({
    color: { brand: { $type: "color", $value: "#ff0000" } },
    space: { sm: { $type: "dimension" } },
  }));

  assert(
    error.includes("sm"),
    `the error must name the offending token, got: ${error}`,
  );
});
