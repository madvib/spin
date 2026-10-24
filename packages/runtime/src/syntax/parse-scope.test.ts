import { test } from "bun:test";
import assert from "node:assert/strict";
import { deepStrictEqual } from "node:assert/strict";
import { coerceProps, parseScope } from "./parse.ts";
import type { PropDecl } from "./ir.ts";

test("parseScope parses object form with all prop types", () => {
  const src =
    `<scope>props={ count: int = 0, name: string = "default", active: bool = true, tags: string[] = "a,b", items: { id: int, label: string }[] = [] }</scope>`;
  const block = parseScope(src);
  deepStrictEqual(block.props.length, 5);
  deepStrictEqual(block.props[0], { name: "count", type: "int", default: "0" });
  deepStrictEqual(block.props[1], {
    name: "name",
    type: "string",
    default: "default",
  });
  deepStrictEqual(block.props[2], {
    name: "active",
    type: "bool",
    default: "true",
  });
  deepStrictEqual(block.props[3], {
    name: "tags",
    type: "string[]",
    default: "a,b",
  });
  deepStrictEqual(block.props[4], {
    name: "items",
    type: "object-array",
    fields: [
      { name: "id", type: "int" },
      { name: "label", type: "string" },
    ],
    default: "[]",
  });
});

test("parseScope parses consume list", () => {
  const src =
    `<scope>props={ name: string }, consume={ theme, router }</scope>`;
  const block = parseScope(src);
  deepStrictEqual(block.props.length, 1);
  deepStrictEqual(block.props[0], { name: "name", type: "string" });
  deepStrictEqual(block.consume, ["theme", "router"]);
});

test("parseScope rejects flat-form props with diagnostic", () => {
  const src = `<scope>props: { name: string }</scope>`;
  let msg = "";
  try {
    parseScope(src);
  } catch (error) {
    msg = (error as Error).message;
  }
  assert(
    msg.includes("flat 'props:' form is no longer supported"),
    `unexpected message: ${msg}`,
  );
  assert(
    msg.includes("props={ name: type = default, ... }"),
    `unexpected message: ${msg}`,
  );
});

test("coerceProps parses JSON-attr for object-array", () => {
  const decls: PropDecl[] = [
    {
      name: "items",
      type: "object-array",
      fields: [{ name: "id", type: "int" }, { name: "label", type: "string" }],
    },
  ];
  const attrs = { items: '[{"id": 1, "label": "a"}, {"id": 2, "label": "b"}]' };
  const result = coerceProps(decls, attrs);
  deepStrictEqual(result.items, [{ id: 1, label: "a" }, { id: 2, label: "b" }]);
});

test("coerceProps uses dashed property-write fallback", () => {
  const decls: PropDecl[] = [{ name: "maxCount", type: "int", default: "10" }];
  const attrs = { "max-count": "42" };
  const result = coerceProps(decls, attrs);
  deepStrictEqual(result.maxCount, 42);
  deepStrictEqual(result["max-count"], 42);
});

test("coerceProps field-fallback: int NaN becomes undefined but item is kept", () => {
  const decls: PropDecl[] = [
    {
      name: "items",
      type: "object-array",
      fields: [{ name: "id", type: "int" }, { name: "label", type: "string" }],
    },
  ];
  const attrs = { items: '[{"id": "not-a-number", "label": "test"}]' };
  const result = coerceProps(decls, attrs);
  const items = result.items as Record<string, unknown>[];
  deepStrictEqual(items.length, 1);
  deepStrictEqual(items[0]!.id, undefined);
  deepStrictEqual(items[0]!.label, "test");
});

test("string defaults arrive unquoted (orientation regression)", () => {
  const src =
    `<scope>props={ orientation: string = "horizontal", role: string = "dialog", empty: string = "" }</scope>`;
  const block = parseScope(src);
  const result = coerceProps(block.props, {});
  deepStrictEqual(result.orientation, "horizontal");
  deepStrictEqual(result.role, "dialog");
  deepStrictEqual(result.empty, "");
});
