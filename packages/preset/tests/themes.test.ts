import { assert, assertEquals } from "@std/assert";
import { parseTokens, validateLegibility, validateTokens } from "@spin/theme";
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
      new URL(`../../theme/examples/${name}`, import.meta.url),
    ),
  );
}

/** A base document: the whole surface, nothing layered over it. */
for (const name of ["default/light.json", "console.json", "neobrut.json"]) {
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
 * sound. `default/dark.json` declares 27 tokens fewer than the full surface
 * and reports no other issue; requiring completeness of it would be requiring
 * a dark theme to ignore its own light one.
 */
Deno.test("a dark document is a sound override, not a restatement", () => {
  const parsed = parseTokens(example("default/dark.json"));
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, {
    required: [...allRequiredRoles()],
  });
  const sound = report.issues.filter((issue) =>
    !issue.message.startsWith("missing")
  );
  assertEquals(sound, [], "a dark override must declare nothing unsound");
  assertEquals(validateLegibility(parsed.tree), []);
  assert(
    report.issues.some((issue) => issue.message.startsWith("missing")),
    "and it is expected to be partial — this asserts nothing if it is not",
  );
});
