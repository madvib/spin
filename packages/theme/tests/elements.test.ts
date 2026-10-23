import { assert, assertEquals } from "@std/assert";
import {
  ELEMENT_ROLES,
  elementPaths,
  legibilityFloors,
  parseTokens,
  requiredPaths,
  scaffoldTheme,
  treeToJson,
  validateTokens,
} from "@spin/theme";
import type { TokenNode } from "@spin/theme";
import { starterThemes, themeModes } from "@spin/theme/themes";

/**
 * The per-element contract, held to the same gates as the base one.
 *
 * A per-element group is a decision an ELEMENT owns, and the theme is what
 * makes it. So the gates are the same three the base roles answer to: every
 * starter declares the groups the contract knows, a scaffold carries them
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

Deno.test("every starter declares every per-element token the contract knows", () => {
  // The groups are the theme's own decisions, so a starter that leaves one
  // out is a starter that has not made the decision: the primitive falls
  // back to the shared scale and the theme's voice is missing. The starters
  // are the product, and the product shows what it decided.
  for (const [name, doc] of Object.entries(starterThemes)) {
    const parsed = parseTokens(doc);
    if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
    const declared = pathsOf(parsed.tree);
    for (const path of elementPaths()) {
      assert(
        declared.has(path),
        `${name}: the starter must declare ${path}`,
      );
    }
  }
});

Deno.test("a scaffold carries every per-element token", () => {
  // The scaffold is the document an author edits, and the studio writes it
  // when a theme is created. A per-element token missing from it is a
  // decision the author is never shown — and a rule that falls back to the
  // shared scale because the document was too empty to say otherwise.
  const declared = pathsOf(scaffoldTheme());
  for (const path of elementPaths()) {
    assert(declared.has(path), `the scaffold must carry ${path}`);
  }
});

Deno.test("a scaffolded theme validates with every per-element group in it", () => {
  // The scaffold's values are placeholders, but they must be sound: a
  // scaffold that does not validate is a document the studio writes and the
  // validator rejects.
  const parsed = parseTokens(treeToJson(scaffoldTheme()));
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, { required: requiredPaths() });
  assertEquals(report.issues, []);
});

Deno.test("the ink the danger surfaces wear is a role the contract asks for", () => {
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
  assertEquals(floor, {
    fg: "color.on-semantic-error",
    bg: "color.semantic.error",
    min: 4.5,
  });
  for (const [name, doc] of Object.entries(starterThemes)) {
    const parsed = parseTokens(doc);
    if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
    assert(
      pathsOf(parsed.tree).has("color.on-semantic-error"),
      `${name}: the starter must carry the ink on the error fill`,
    );
  }
});

Deno.test("a theme that serves a mode it does not override is valid", () => {
  // The modes a theme serves are a claim, not a promise to restate
  // everything: a mode it serves but does not override falls back to the
  // base values. So a theme that serves dark and overrides nothing is a
  // complete theme — which is exactly what a dark-only theme is.
  const parsed = parseTokens({
    ...starterThemes.console,
  });
  if (!parsed.ok) throw new Error(parsed.error);
  const modes = themeModes(starterThemes.console);
  assertEquals([...modes], ["dark"]);
  const report = validateTokens(parsed.tree, {
    required: requiredPaths(),
    modes: [...modes],
  });
  assertEquals(report.issues, []);
});

Deno.test("a value written for a mode the theme does not serve is reported", () => {
  // The other side of the same rule: a `$modes.dark` value on a theme that
  // serves only light is never shown, so the declaration is a promise nothing
  // keeps — and the author should hear about it.
  const parsed = parseTokens({
    ...starterThemes.neobrut,
    color: {
      ...(starterThemes.neobrut["color"] as Record<string, unknown>),
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

Deno.test("every per-element token names the group it belongs to", () => {
  // The group IS the element: a card's corner lives under `card`, a stat's
  // number under `stat`. A token filed under another element's group is a
  // token the wrong rule would spend.
  for (const role of ELEMENT_ROLES) {
    assertEquals(
      role.path.split(".")[0],
      role.group,
      `${role.path} must live in its own group`,
    );
    assertEquals(role.element, role.group);
  }
});
