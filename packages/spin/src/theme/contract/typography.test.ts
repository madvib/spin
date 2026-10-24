import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import {
  ELEMENT_TYPE_ROLES,
  elementTypeElements,
  elementTypeFallback,
  elementTypeFields,
  elementTypePaths,
  elementTypeRole,
  FACE_CHAINS,
  parseTokens,
  requiredPaths,
  themeSchema,
  validateTokens,
} from "../index.ts";
import { starterThemes } from "../themes/index.ts";

/**
 * The per-element typography, as a contract.
 *
 * Three things have to hold: the group is OPTIONAL, so a theme that never
 * mentions it is complete; every path it names is a path the theme language
 * has; and every fallback is a path a rule can actually read, so the answer
 * a theme gets by saying nothing is an answer that exists.
 */

test("the per-element typography is optional", () => {
  // A theme that says nothing about a heading gets the system's answer, so
  // the group cannot be required — and the schema must not say it is.
  const schema = themeSchema();
  const font = schema["properties"] as Record<string, {
    properties?: Record<string, unknown>;
    required?: string[];
  }>;
  const element = font["font"]?.properties?.["element"] as {
    properties?: Record<string, unknown>;
    required?: string[];
  } | undefined;
  assert(element !== undefined, "the schema must know the group");
  deepStrictEqual(
    element.required,
    undefined,
    "the group a theme may leave out must not be required",
  );
  const h1 = element.properties?.["h1"] as {
    properties?: Record<string, unknown>;
    required?: string[];
  } | undefined;
  assert(h1 !== undefined, "the schema must know the first heading");
  deepStrictEqual(
    h1.required,
    undefined,
    "a heading's decisions are the theme's to make, not the schema's to demand",
  );
});

test("a theme that declares no per-element typography is valid", () => {
  // The whole point of the fallback: the group is a decision a theme MAY
  // make, so a document without it owes nothing.
  const parsed = parseTokens(starterThemes.silk);
  if (!parsed.ok) throw new Error(parsed.error);
  const report = validateTokens(parsed.tree, { required: requiredPaths() });
  deepStrictEqual(report.issues, []);
});

test("every per-element path is a path the theme language has", () => {
  // A fallback the theme language does not have is an answer that cannot be
  // given, and the rule that spends it would reach for nothing.
  const known = new Set([
    ...requiredPaths(),
    "font.family.heading",
    "font.family.body",
    "font.family.serif",
    "font.family.mono",
    "font.size.xs",
    "font.size.sm",
    "font.size.md",
    "font.size.lg",
    "font.size.xl",
    "font.size.2xl",
    "font.size.3xl",
    "font.weight.regular",
    "font.weight.medium",
    "font.weight.semibold",
    "font.weight.bold",
  ]);
  for (const role of ELEMENT_TYPE_ROLES) {
    assert(
      known.has(role.fallback),
      `${role.path} falls back to ${role.fallback}, which the theme language does not have`,
    );
  }
  for (const chain of Object.values(FACE_CHAINS)) {
    for (const step of chain) {
      assert(
        known.has(step),
        `the face chain steps through ${step}, which the theme language does not have`,
      );
    }
  }
});

test("every per-element path is named after the element it belongs to", () => {
  // The path IS the identity: `font.element.h1.size` is the size of an `h1`,
  // and a path that named another element would be a decision the wrong rule
  // spends.
  for (const role of ELEMENT_TYPE_ROLES) {
    deepStrictEqual(
      role.path,
      `font.element.${role.element}.${role.field}`,
      `${role.path} must name its own element and field`,
    );
  }
});

test("every element the contract names has all three decisions", () => {
  // A half-declared element is an element the theme can set a face for and
  // not a size for, which reads as an accident rather than a decision.
  for (const element of elementTypeElements()) {
    const fields = elementTypeFields(element);
    for (const field of ["family", "size", "weight"] as const) {
      assert(
        fields[field] !== undefined,
        `${element} must have a ${field} decision`,
      );
    }
  }
  deepStrictEqual(
    elementTypePaths().length,
    elementTypeElements().length * 3,
    "every element carries exactly three decisions",
  );
});

test("the declaration for a path is the one that path names", () => {
  for (const path of elementTypePaths()) {
    const role = elementTypeRole(path);
    assert(role !== undefined, `${path} must be declared`);
    deepStrictEqual(role.path, path);
    deepStrictEqual(elementTypeFallback(path), role.fallback);
  }
});
