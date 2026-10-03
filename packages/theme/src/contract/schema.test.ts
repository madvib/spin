import { assert, assertEquals } from "@std/assert";
import { parseTokens } from "../pipeline/parse.ts";
import { validateTokens } from "../pipeline/validate.ts";
import { TOKEN_TYPES } from "../pipeline/types.ts";
import { CSS_WIDE_COLORS } from "../pipeline/color.ts";
import {
  BASE_ROLES,
  requiredPaths,
  spinThemeJsonSchema,
  validateLegibility,
} from "./schema.ts";

function example(name: string): unknown {
  return JSON.parse(
    Deno.readTextFileSync(
      new URL(`../../examples/${name}`, import.meta.url),
    ),
  );
}

Deno.test("the derived schema requires exactly the declared roles", () => {
  // The contract is one declaration; the schema is a derivation. This is the
  // check that makes that true rather than aspirational: every declared role is
  // required, and nothing else is.
  const schema = spinThemeJsonSchema() as Record<string, unknown>;
  const required = new Set(requiredLeaves(schema));
  assertEquals(
    [...required].sort(),
    [...requiredPaths()].sort(),
    "the schema requires the declaration and nothing else",
  );
});

/** Every role the schema marks required, walking its nesting. */
function requiredLeaves(
  node: Record<string, unknown>,
  prefix: string[] = [],
): string[] {
  const out: string[] = [];
  const properties = (node["properties"] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  for (const key of (node["required"] as string[] | undefined) ?? []) {
    // A leaf requires `$value`, `$type` and `$description`. Those are token
    // fields, not nested groups, so a `$`-prefixed key ends the walk.
    if (key.startsWith("$")) continue;
    const path = [...prefix, key];
    const child = properties[key];
    if (isGroup(child)) {
      out.push(...requiredLeaves(child, path));
    } else {
      out.push(path.join("."));
    }
  }
  return out;
}

/**
 * A group declares role-named children; a leaf declares only token fields.
 * Both have a `properties` object, so the discriminator is whether any
 * property is a role rather than a `$`-prefixed field.
 */
function isGroup(node: Record<string, unknown> | undefined): boolean {
  const properties = (node?.["properties"] ?? {}) as Record<string, unknown>;
  return Object.keys(properties).some((key) => !key.startsWith("$"));
}

Deno.test("schema.json matches the derived builder output", async () => {
  const artifact = JSON.parse(
    await Deno.readTextFile(new URL("../../schema.json", import.meta.url)),
  );
  // The builder returns a TypeBox type, which is JSON Schema plus TypeScript's
  // optionality marker; the artifact is the JSON that marker disappears from.
  const derived = JSON.parse(JSON.stringify(spinThemeJsonSchema()));
  assertEquals(artifact, derived);
});
for (
  const name of ["default/light.json", "console.json", "neobrut.json"]
) {
  Deno.test(`${name} meets every legibility floor`, () => {
    const parsed = parseTokens(example(name));
    if (!parsed.ok) throw new Error(parsed.error);
    assertEquals(validateLegibility(parsed.tree), []);
  });
}

Deno.test("a theme missing a required role fails the contract", () => {
  const parsed = parseTokens({
    color: {
      $type: "color",
      primary: { $value: "#fff" },
    },
  });
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, { required: requiredPaths() });
  assert(report.issues.some((issue) => issue.path === "color.text"));
});

Deno.test("an illegible pair fails legibility", () => {
  const parsed = parseTokens({
    color: {
      $type: "color",
      text: { $value: "#777777" },
      "text-muted": { $value: "#777777" },
      surface: { $value: "#888888" },
      "surface-raised": { $value: "#888888" },
      border: { $value: "#888888" },
      primary: { $value: "#777777" },
      secondary: { $value: "#777777" },
      accent: { $value: "#777777" },
      semantic: {
        success: { $value: "#777777" },
        warning: { $value: "#777777" },
        error: { $value: "#777777" },
        info: { $value: "#777777" },
      },
    },
    font: {
      family: { $type: "fontFamily", sans: { $value: "sans" } },
    },
  });
  if (!parsed.ok) throw new Error(parsed.error);
  const issues = validateLegibility(parsed.tree);
  assert(issues.some((issue) => issue.path === "color.text"));
});

Deno.test("the vocabulary is closed, and its edge is spelled out", () => {
  // Both are exported for consumers, so both are stated: a theme author needs
  // to know which types exist, and the lint plugin needs to know which colour
  // words are vocabulary rather than a raw value.
  assert(TOKEN_TYPES.includes("color"));
  assert(TOKEN_TYPES.includes("dimension"));
  const all: readonly string[] = TOKEN_TYPES;
  assert(!all.includes("string"), "unbounded values are not a type");
  assertEquals([...CSS_WIDE_COLORS], ["transparent", "currentColor"]);
});

Deno.test("the declaration is the single source of the required paths", () => {
  assertEquals(
    requiredPaths(),
    BASE_ROLES.map((role) => role.path),
    "the derivation reads the declaration and nothing else",
  );
  assert(
    BASE_ROLES.every((role) => role.doc.length > 0 && role.value.length > 0),
    "every role documents itself and can be scaffolded",
  );
});
