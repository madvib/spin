import { assert, assertEquals } from "@std/assert";
import { indexTree, parseTokens, validateLegibility, validateTokens } from "@spin/theme";
import { allRequiredRoles } from "../src/index.ts";

/**
 * The shipped example themes are the reference implementations of "a theme
 * that satisfies the whole surface". Completeness is a composition claim — it
 * needs the base roles plus every enabled primitive's character tokens — so it
 * is asserted here, where that composition lives, rather than in
 * `@spin/theme`, which cannot see the primitives at all.
 */
function example(name: string): unknown {
  return JSON.parse(
    Deno.readTextFileSync(
      new URL(`../../theme/src/themes/${name}`, import.meta.url),
    ),
  );
}

/** A base document: the whole surface, nothing layered over it. */
for (const name of ["default.json", "neobrut.json", "console.json"]) {
  Deno.test(`${name} satisfies every required role`, () => {
    const parsed = parseTokens(example(name));
    if (!parsed.ok) throw new Error(parsed.error);
    const report = validateTokens(parsed.tree, {
      required: [...allRequiredRoles()],
    });
    assertEquals(
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
Deno.test("a dark MODE restates what it flips and inherits the rest", () => {
  // `dark` is a MODE, not a document: it lives inside the theme and says what
  // changes. So the property to check is that every path it declares is one the
  // theme already declares — a mode that introduced a NEW token would be a
  // second theme wearing a mode's name.
  const parsed = parseTokens(example("default.json"));
  if (!parsed.ok) throw new Error(parsed.error);

  const declared = new Set(
    Object.keys(indexTree(parsed.tree).leaves).map((k) => k),
  );
  const dark = parsed.tree.find((node) => node.path.join(".") === "dark");
  assert(dark !== undefined, "the theme must carry a dark group");

  const base = new Set(
    parsed.tree
      .filter((node) => node.path.join(".") !== "dark")
      .flatMap((node) =>
        Object.keys(indexTree([node]).leaves).map((k) => k.replace(/^dark\./, ""))
      ),
  );
  for (const leaf of Object.keys(indexTree([dark]).leaves)) {
    const bare_ = leaf.replace(/^dark\./, "");
    assert(
      base.has(bare_) || declared.has(bare_),
      `dark declares ${bare_}, which the theme does not — a mode may only ` +
        `restate, never introduce`,
    );
  }
});
