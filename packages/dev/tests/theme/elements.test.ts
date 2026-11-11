import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  ELEMENT_ROLES,
  elementPaths,
  legibilityFloors,
  parseTokens,
  requiredPaths,
  validateTokens,
} from "@spinjs/theme";
import type { TokenNode } from "@spinjs/theme";
import { designLanguages, themeModes } from "@spinjs/theme";

/**
 * The per-element contract, held to the same gates as the base one.
 *
 * A per-element group is a decision an ELEMENT owns, and the theme is what
  * makes it. So the gates are the same three the base roles answer to: every
  * language declares the groups the contract knows, minimal states them
  * all, and the ink the danger surfaces wear is a role the contract asks for
  * rather than a name nothing reads.
 */

/** Every leaf in a tree, by its dotted path. */
function pathsOf(nodes: readonly TokenNode[]): Set<string> {
  const out = new Set<string>();
  const walk = (node: TokenNode): void => {
    if (node.kind === "token") {
      out.add(node.path.join("."));
      return;
    }
    for (const child of node.children) walk(child);
  };
  for (const node of nodes) walk(node);
  return out;
}

test("every language declares every per-element token the contract knows", () => {
  // The groups are the theme's own decisions, so a language that leaves one
  // out is a language that has not made the decision: the primitive falls
  // back to the shared scale and the theme's voice is missing. The languages
  // are the product, and the product shows what it decided.
  for (const [name, doc] of Object.entries(designLanguages)) {
    const parsed = parseTokens(doc);
    if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
    const declared = pathsOf(parsed.tree);
    for (const path of elementPaths()) {
      assert(
        declared.has(path),
        `${name}: the language must declare ${path}`,
      );
    }
  }
});

test("minimal states every per-element token", () => {
  // The languages are the documents an author reads, and the studio reads
  // them when a theme is created. A per-element token missing from minimal is
  // a decision the author is never shown — and a rule that falls back to
  // the shared scale because the document was too empty to say otherwise.
  const parsed = parseTokens(designLanguages.minimal);
  if (!parsed.ok) throw new Error(parsed.error);
  const declared = pathsOf(parsed.tree);
  for (const path of elementPaths()) {
    assert(declared.has(path), `silk must carry ${path}`);
  }
});

test("a minimal document validates with every per-element group in it", () => {
  // minimal's values must be sound: a language that does not validate is a
  // document the studio reads and the validator rejects.
  const parsed = parseTokens(designLanguages.minimal);
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, { required: requiredPaths() });
  deepStrictEqual(report.issues, []);
});

test("the ink the danger surfaces wear is a role the contract asks for", () => {
  // The danger button and the danger badge paint the error fill, so the ink
  // on it is a REQUIRED role with a floor — not a name the theme may or may
  // not declare. A theme that satisfies the contract must therefore carry
  // the ink its danger surfaces wear.
  assert(
    requiredPaths().includes("color.on-semantic-error"),
    "the ink on the error fill is a role",
  );
  const floor = legibilityFloors().find((entry) =>
    entry.fg === "color.on-semantic-error"
  );
  deepStrictEqual(floor, {
    fg: "color.on-semantic-error",
    bg: "color.semantic.error",
    min: 4.5,
  });
  for (const [name, doc] of Object.entries(designLanguages)) {
    const parsed = parseTokens(doc);
    if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
    assert(
      pathsOf(parsed.tree).has("color.on-semantic-error"),
      `${name}: the language must carry the ink on the error fill`,
    );
  }
});

test("a theme that serves a mode it does not override is valid", () => {
  const darkOnly = structuredClone(designLanguages.neumorphic) as Record<string, unknown>;
  for (const group of Object.values(darkOnly)) {
    if (group && typeof group === "object") {
      for (const leaf of Object.values(group as Record<string, unknown>)) {
        if (leaf && typeof leaf === "object") delete (leaf as Record<string, unknown>)["$modes"];
      }
    }
  }
  darkOnly["modes"] = ["dark"];
  const parsed = parseTokens(darkOnly);
  if (!parsed.ok) throw new Error(parsed.error);
  const modes = themeModes(darkOnly);
  deepStrictEqual([...modes], ["dark"]);
  const report = validateTokens(parsed.tree, {
    required: requiredPaths(),
    modes: [...modes],
  });
  deepStrictEqual(report.issues, []);
});

test("a value written for a mode the theme does not serve is reported", () => {
  const parsed = parseTokens({
    ...designLanguages.neobrutalist,
    modes: ["light"],
    color: {
      ...(designLanguages.neobrutalist["color"] as Record<string, unknown>),
      primary: {
        $value: "#2b5fd0",
        $modes: { dark: "#8db9fa" },
      },
    },
  });
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, { modes: ["light"] });
  assert(
    report.issues.some((issue) =>
      issue.path === "color.primary" && issue.message.includes("does not serve")
    ),
    `the dead override is not reported: ${JSON.stringify(report.issues)}`,
  );
});

test("every per-element token names the group it belongs to", () => {
  // The group IS the element: a card's corner lives under `card`, a stat's
  // number under `stat`. A token filed under another element's group is a
  // token the wrong rule would spend.
  for (const role of ELEMENT_ROLES) {
    deepStrictEqual(
      role.path.split(".")[0],
      role.group,
      `${role.path} must live in its own group`,
    );
    deepStrictEqual(role.element, role.group);
  }
});
