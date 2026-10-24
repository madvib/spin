import { assert, assertEquals, assertThrows } from "@std/assert";
import { coerceProps, parseScope } from "./parse.ts";
import type { PropDecl } from "./ir.ts";

Deno.test("parseScope parses object form with all prop types", () => {
  const src =
    `<scope>props={ count: int = 0, name: string = "default", active: bool = true, tags: string[] = "a,b", items: { id: int, label: string }[] = [] }</scope>`;
  const block = parseScope(src);
  assertEquals(block.props.length, 5);
  assertEquals(block.props[0], { name: "count", type: "int", default: "0" });
  assertEquals(block.props[1], {
    name: "name",
    type: "string",
    default: "default",
  });
  assertEquals(block.props[2], {
    name: "active",
    type: "bool",
    default: "true",
  });
  assertEquals(block.props[3], {
    name: "tags",
    type: "string[]",
    default: "a,b",
  });
  assertEquals(block.props[4], {
    name: "items",
    type: "object-array",
    fields: [
      { name: "id", type: "int" },
      { name: "label", type: "string" },
    ],
    default: "[]",
  });
});

Deno.test("parseScope parses consume list", () => {
  const src =
    `<scope>props={ name: string }, consume={ theme, router }</scope>`;
  const block = parseScope(src);
  assertEquals(block.props.length, 1);
  assertEquals(block.props[0], { name: "name", type: "string" });
  assertEquals(block.consume, ["theme", "router"]);
});

Deno.test("parseScope rejects flat-form props with diagnostic", () => {
  const src = `<scope>props: { name: string }</scope>`;
  const err = assertThrows(() => parseScope(src), Error);
  const msg = err.message;
  assert(
    msg.includes("flat 'props:' form is no longer supported"),
    `unexpected message: ${msg}`,
  );
  assert(
    msg.includes("props={ name: type = default, ... }"),
    `unexpected message: ${msg}`,
  );
});

Deno.test("coerceProps parses JSON-attr for object-array", () => {
  const decls: PropDecl[] = [
    {
      name: "items",
      type: "object-array",
      fields: [{ name: "id", type: "int" }, { name: "label", type: "string" }],
    },
  ];
  const attrs = { items: '[{"id": 1, "label": "a"}, {"id": 2, "label": "b"}]' };
  const result = coerceProps(decls, attrs);
  assertEquals(result.items, [{ id: 1, label: "a" }, { id: 2, label: "b" }]);
});

Deno.test("coerceProps uses dashed property-write fallback", () => {
  const decls: PropDecl[] = [{ name: "maxCount", type: "int", default: "10" }];
  const attrs = { "max-count": "42" };
  const result = coerceProps(decls, attrs);
  assertEquals(result.maxCount, 42);
  assertEquals(result["max-count"], 42);
});

Deno.test("coerceProps field-fallback: int NaN becomes undefined but item is kept", () => {
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
  assertEquals(items.length, 1);
  assertEquals(items[0]!.id, undefined);
  assertEquals(items[0]!.label, "test");
});

Deno.test("string defaults arrive unquoted (orientation regression)", () => {
  const src =
    `<scope>props={ orientation: string = "horizontal", role: string = "dialog", empty: string = "" }</scope>`;
  const block = parseScope(src);
  const result = coerceProps(block.props, {});
  assertEquals(result.orientation, "horizontal");
  assertEquals(result.role, "dialog");
  assertEquals(result.empty, "");
});
