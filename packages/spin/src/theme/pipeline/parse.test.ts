import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { treeToJson } from "../authoring/mutate.ts";
import { ownedStyleNames } from "../contract/typography.ts";
import { expandExtends } from "../extends.ts";
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

test("parseTokens accepts a DTCG document supplied as a JSON string", () => {
  const tree = treeOf(parseTokens(JSON.stringify(LIGHT_TOKENS)));

  deepStrictEqual(leafAt(tree, "color.brand").type, "color");
  deepStrictEqual(leafAt(tree, "color.brand").value, "#ff0000");
  deepStrictEqual(leafAt(tree, "space.sm").value, "4px");
});

test("parseTokens yields the same tree for JSON text and for an already-decoded object", () => {
  const fromText = treeOf(parseTokens(JSON.stringify(LIGHT_TOKENS)));
  const fromObject = treeOf(parseTokens(structuredClone(LIGHT_TOKENS)));

  deepStrictEqual(leafValues(fromObject), leafValues(fromText));
});

test("parseTokens exposes the dotted path of a token nested in several groups", () => {
  const tree = treeOf(parseTokens({
    color: { button: { primary: { $type: "color", $value: "#00ff00" } } },
  }));

  deepStrictEqual(leafAt(tree, "color.button.primary").value, "#00ff00");
  deepStrictEqual(leafAt(tree, "color.button.primary").path, [
    "color",
    "button",
    "primary",
  ]);
});

test("parseTokens keeps group nodes in the tree alongside their tokens", () => {
  const tree = treeOf(parseTokens(LIGHT_TOKENS));
  const color = groupAt(tree, "color");

  deepStrictEqual(
    color.children.map((child) => child.name).sort(),
    ["accent", "brand"],
  );
});

test("parseTokens carries the $description onto the token", () => {
  const tree = treeOf(parseTokens(LIGHT_TOKENS));

  deepStrictEqual(leafAt(tree, "color.brand").description, "Primary brand hue");
});

test("parseTokens preserves an alias value verbatim so it can be resolved later", () => {
  const tree = treeOf(parseTokens(LIGHT_TOKENS));

  deepStrictEqual(leafAt(tree, "color.accent").value, "{color.brand}");
});

test("parseTokens lets a group-level $type stand in for its tokens", () => {
  const tree = treeOf(parseTokens({
    color: { $type: "color", brand: { $value: "#123456" } },
  }));

  deepStrictEqual(leafAt(tree, "color.brand").type, "color");
});
test("parseTokens reports a document that declares no tokens", () => {
  const error = errorOf(parseTokens({}));

  deepStrictEqual(error, "token document contains no tokens");
});

test("parseTokens reports malformed JSON with a non-blank message", () => {
  const error = errorOf(parseTokens('{"color": '));

  assert(
    error.startsWith("invalid JSON"),
    `a parse failure must explain what went wrong, got: ${error}`,
  );
});

test("parseTokens rejects a token that declares a $type but no $value", () => {
  const error = errorOf(parseTokens({ color: { brand: { $type: "color" } } }));

  assert(
    error.includes("brand"),
    `the error must name the offending token, got: ${error}`,
  );
});

test("parseTokens rejects a token that declares a $value but no $type", () => {
  const error = errorOf(
    parseTokens({ color: { brand: { $value: "#ff0000" } } }),
  );

  assert(
    error.includes("brand"),
    `the error must name the offending token, got: ${error}`,
  );
});

test("parseTokens rejects a document that mixes a valid group with a valueless one", () => {
  const error = errorOf(parseTokens({
    color: { brand: { $type: "color", $value: "#ff0000" } },
    space: { sm: { $type: "dimension" } },
  }));

  assert(
    error.includes("sm"),
    `the error must name the offending token, got: ${error}`,
  );
});

test("parseTokens expands a composite typography tuple to the five style leaves", () => {
  const tree = treeOf(parseTokens({
    font: {
      style: {
        body: {
          $type: "typography",
          $description: "The body voice.",
          $value: {
            family: "{font.family.sans}",
            size: "{font.size.md}",
            weight: "{font.weight.regular}",
            tracking: "{font.tracking.normal}",
            leading: "{font.leading.relaxed}",
          },
        },
      },
    },
  }));

  deepStrictEqual(leafAt(tree, "font.style.body.family").type, "fontFamily");
  deepStrictEqual(leafAt(tree, "font.style.body.family").value, "{font.family.sans}");
  deepStrictEqual(leafAt(tree, "font.style.body.size").type, "dimension");
  deepStrictEqual(leafAt(tree, "font.style.body.weight").type, "fontWeight");
  deepStrictEqual(leafAt(tree, "font.style.body.tracking").type, "dimension");
  deepStrictEqual(leafAt(tree, "font.style.body.leading").type, "dimension");
});

test("parseTokens normalizes the composite and group forms to the same tree", () => {
  const tuple = {
    family: "{font.family.sans}",
    size: "{font.size.md}",
    weight: "{font.weight.regular}",
    tracking: "{font.tracking.normal}",
    leading: "{font.leading.relaxed}",
  };
  const composite = treeOf(parseTokens({
    font: { style: { body: { $type: "typography", $value: tuple } } },
  }));
  const grouped = treeOf(parseTokens({
    font: {
      style: {
        body: {
          family: { $type: "fontFamily", $value: tuple.family },
          size: { $type: "dimension", $value: tuple.size },
          weight: { $type: "fontWeight", $value: tuple.weight },
          tracking: { $type: "dimension", $value: tuple.tracking },
          leading: { $type: "dimension", $value: tuple.leading },
        },
      },
    },
  }));

  deepStrictEqual(leafValues(composite), leafValues(grouped));
});

test("parseTokens rejects a composite tuple missing a field", () => {
  const error = errorOf(parseTokens({
    font: {
      style: {
        body: {
          $type: "typography",
          $value: { family: "{font.family.sans}", size: "{font.size.md}" },
        },
      },
    },
  }));

  assert(
    error.includes("font.style.body"),
    `the error must name the offending tuple, got: ${error}`,
  );
});
test("parseTokens expands a whole-style alias to the five field aliases", () => {
  const tree = treeOf(parseTokens({
    font: {
      family: { sans: { $type: "fontFamily", $value: "Inter" } },
      size: { md: { $type: "dimension", $value: "1rem" } },
      weight: { regular: { $type: "fontWeight", $value: 400 } },
      tracking: { normal: { $type: "dimension", $value: "0em" } },
      leading: { relaxed: { $type: "dimension", $value: 1.625 } },
      style: {
        body: {
          $type: "typography",
          $value: {
            family: "{font.family.sans}",
            size: "{font.size.md}",
            weight: "{font.weight.regular}",
            tracking: "{font.tracking.normal}",
            leading: "{font.leading.relaxed}",
          },
        },
      },
    },
    button: { type: { $type: "typography", $value: "{font.style.body}" } },
  }));

  deepStrictEqual(leafAt(tree, "button.type.family").type, "fontFamily");
  deepStrictEqual(leafAt(tree, "button.type.family").value, "{font.style.body.family}");
  deepStrictEqual(leafAt(tree, "button.type.size").value, "{font.style.body.size}");
  deepStrictEqual(leafAt(tree, "button.type.weight").value, "{font.style.body.weight}");
  deepStrictEqual(leafAt(tree, "button.type.tracking").value, "{font.style.body.tracking}");
  deepStrictEqual(leafAt(tree, "button.type.leading").value, "{font.style.body.leading}");
});

test("parseTokens rejects a bare style name as a typography $value", () => {
  const error = errorOf(parseTokens({
    button: { type: { $type: "typography", $value: "body" } },
  }));

  assert(
    error.includes("button.type"),
    `the error must name the offending token, got: ${error}`,
  );
});

test("treeToJson serializes a whole-style alias back to the single reference", () => {
  const tree = treeOf(parseTokens({
    button: { type: { $type: "typography", $value: "{font.style.body}" } },
  }));

  const doc = JSON.parse(treeToJson(tree)) as Record<string, unknown>;
  const button = doc["button"] as Record<string, unknown>;
  deepStrictEqual(button["type"], {
    $type: "typography",
    $value: "{font.style.body}",
  });
  deepStrictEqual(leafValues(treeOf(parseTokens(doc))), leafValues(tree));
});


test("treeToJson serializes a style tuple as the compact composite", () => {
  const tree = treeOf(parseTokens({
    font: {
      style: {
        body: {
          family: { $type: "fontFamily", $value: "{font.family.sans}" },
          size: { $type: "dimension", $value: "{font.size.md}" },
          weight: { $type: "fontWeight", $value: "{font.weight.regular}" },
          tracking: { $type: "dimension", $value: "{font.tracking.normal}" },
          leading: { $type: "dimension", $value: "{font.leading.relaxed}" },
        },
      },
    },
  }));

  const doc = JSON.parse(treeToJson(tree)) as Record<string, unknown>;
  const body = (doc["font"] as Record<string, unknown>)["style"] as Record<
    string,
    unknown
  >;
  deepStrictEqual(body["body"], {
    $type: "typography",
    $value: {
      family: "{font.family.sans}",
      size: "{font.size.md}",
      weight: "{font.weight.regular}",
      tracking: "{font.tracking.normal}",
      leading: "{font.leading.relaxed}",
    },
  });
  // The composite a serializer writes is one the parser reads back.
  deepStrictEqual(leafValues(treeOf(parseTokens(doc))), leafValues(tree));
});

test("parseTokens resolves $extends to the complete starter document", () => {
  // A sparse document layers one override over its starter; the tree reads
  // as the document the author would have vendored.
  const tree = treeOf(parseTokens({
    $extends: "silk",
    modes: ["light", "dark"],
    color: { primary: { $value: "#2563eb" } },
  }));

  deepStrictEqual(leafAt(tree, "color.primary").value, "#2563eb");
  const styles = new Set(
    leaves(tree)
      .filter((leaf) => leaf.path[0] === "font" && leaf.path[1] === "style")
      .map((leaf) => leaf.path[2]),
  );
  deepStrictEqual([...styles].sort(), [...ownedStyleNames()].sort());
});

test("expandExtends throws on an unknown starter", () => {
  assert.throws(
    () => expandExtends({ $extends: "nope" }),
    /unknown starter "nope"/,
  );
  // Through the parser the same mistake is reported, not thrown: the
  // studio's job is to say what is wrong.
  deepStrictEqual(parseTokens({ $extends: "nope" }).ok, false);
});

test("a composite typography token with a null $value is reported, not thrown", () => {
  const result = parseTokens({
    element: { h1: { $type: "typography", $value: null } },
  });
  deepStrictEqual(result.ok, false);
  assert.match(
    result.ok ? "" : result.error,
    /declares \$type "typography" with a \$value that is neither a five-field object/,
  );
});
