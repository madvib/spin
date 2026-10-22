import { assert, assertEquals } from "@std/assert";
import { contrastRatio } from "../pipeline/color.ts";
import { parseTokens } from "../pipeline/parse.ts";
import { generateCss } from "../pipeline/generate.ts";
import { validateTokens } from "../pipeline/validate.ts";
import { themeModes } from "../modes.ts";
import { starterThemes } from "../themes/index.ts";
import { BASE_ROLES, requiredPaths } from "./roles.ts";
import { spinThemeJsonSchema, validateLegibility } from "./schema.ts";

function example(name: string): unknown {
  return JSON.parse(
    Deno.readTextFileSync(
      new URL(`../../src/themes/${name}`, import.meta.url),
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
  const name of ["silk.json", "neobrut.json", "console.json"]
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

Deno.test("every role documents itself and can be scaffolded", () => {
  assert(
    BASE_ROLES.every((role) => role.doc.length > 0 && role.value.length > 0),
    "every role documents itself and can be scaffolded",
  );
});

/**
 * The custom properties one mode's stylesheet declares.
 *
 * The stylesheet is the consumer's view: the base block, with the dark block
 * layered on top for the dark mode. References are left as they are — a
 * browser resolves them, and so does the reader below.
 */
function varsInMode(
  css: string,
  mode: "light" | "dark",
): Record<string, string> {
  const blocks = new Map<string, Record<string, string>>();
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations: Record<string, string> = {};
    for (
      const [, property, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)
    ) {
      declarations[property.trim()] = value.trim();
    }
    blocks.set(selector.trim(), declarations);
  }
  const base = blocks.get(":root") ?? {};
  if (mode === "light") return { ...base };
  return { ...base, ...(blocks.get(':root[data-mode="dark"]') ?? {}) };
}

/** Follows a `var(--x)` chain to a literal, the way a browser resolves it. */
function resolve(vars: Record<string, string>, name: string): string {
  let value = vars[name];
  if (value === undefined) throw new Error(`no value for ${name}`);
  for (let hop = 0; hop < 10; hop++) {
    const reference = /^var\((--[\w-]+)\)$/.exec(value);
    if (reference === null) return value;
    const next = vars[reference[1] as string];
    if (next === undefined) {
      throw new Error(`${name} points at undeclared ${reference[1]}`);
    }
    value = next;
  }
  throw new Error(`${name} did not resolve to a literal value`);
}

Deno.test("every starter declares the dead pair, and it reads in every mode", () => {
  // A disabled control is not a dimmer control: dimming spends opacity on the
  // whole element, so the ink dims with the fill, and a white label on a
  // blue button lands at 1.56:1. The pair is what keeps a dead control
  // legible — so every starter states both halves, and the ink clears the
  // text floor on the fill in every mode the theme serves.
  for (const [name, doc] of Object.entries(starterThemes)) {
    const parsed = parseTokens(doc);
    if (!parsed.ok) throw new Error(`${name}: ${parsed.error}`);
    const modes = themeModes(doc).includes("dark")
      ? (["light", "dark"] as const)
      : (["light"] as const);
    const css = generateCss(parsed.tree);
    for (const mode of modes) {
      const vars = varsInMode(css, mode);
      const fill = resolve(vars, "--color-disabled");
      const ink = resolve(vars, "--color-on-disabled");
      const ratio = contrastRatio(ink, fill);
      assert(
        ratio >= 4.5,
        `${name} (${mode}): the dead ink measures ${ratio.toFixed(2)}:1 on ` +
          `the dead fill, below the 4.5:1 floor`,
      );
    }
  }
});

Deno.test("the dead pair is a role the contract asks every theme for", () => {
  // Both halves, and the floor that holds them together: the ink on the
  // dead fill is a text pairing, so it owes the text floor.
  const paths = requiredPaths();
  assert(paths.includes("color.disabled"), "the dead fill is a role");
  assert(paths.includes("color.on-disabled"), "the ink on it is a role");
  const floor = BASE_ROLES.find((role) => role.path === "color.disabled")
    ?.floor;
  assertEquals(floor, {
    fg: "color.on-disabled",
    bg: "color.disabled",
    min: 4.5,
  });
});

Deno.test("a theme that declares the dead pair validates", () => {
  // The pair is a pair: a theme that states one half of it is a theme whose
  // dead control has a fill with no ink, which is the illegibility the roles
  // exist to remove.
  const parsed = parseTokens({
    color: {
      $type: "color",
      text: { $value: "#111111" },
      "text-muted": { $value: "#555555" },
      surface: { $value: "#ffffff" },
      "surface-raised": { $value: "#f0f0f0" },
      border: { $value: "#999999" },
      primary: { $value: "#333333" },
      secondary: { $value: "#444444" },
      accent: { $value: "#555555" },
      disabled: { $value: "#e0e0e0" },
      "on-disabled": { $value: "#3a3a3a" },
      semantic: {
        success: { $value: "#1a7f37" },
        warning: { $value: "#9a6700" },
        error: { $value: "#b42318" },
        info: { $value: "#175cd3" },
      },
      "on-primary": { $value: "#ffffff" },
      "on-secondary": { $value: "#ffffff" },
      "on-accent": { $value: "#ffffff" },
      "on-semantic-success": { $value: "#ffffff" },
      "on-semantic-warning": { $value: "#ffffff" },
      "on-semantic-error": { $value: "#ffffff" },
      "on-semantic-info": { $value: "#ffffff" },
      "focus-ring": { $value: "#333333" },
      link: { $value: "#175cd3" },
    },
    font: {
      family: { $type: "fontFamily", sans: { $value: "sans" } },
    },
    focus: {
      $type: "dimension",
      width: { $value: "2px" },
      offset: { $value: "2px" },
    },
  });
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, { required: requiredPaths() });
  assertEquals(report.issues, []);
  assertEquals(validateLegibility(parsed.tree), []);
});
