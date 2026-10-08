import { assertEquals, assertStringIncludes } from "@std/assert";
import { parse } from "../directives/parse.ts";
import { emit } from "./emit.ts";

Deno.test("emit spread produces bindSpread with scopeExpr rewrite", () => {
  const ir = parse(`<div {...api.getX(row)}></div>`);
  const { js } = emit(ir);
  assertStringIncludes(js, "bindSpread(");
  assertStringIncludes(js, "values.api.getX(values.row)");
});

Deno.test("emit for-template produces balanced bindFor without .sync wrapper", () => {
  const ir = parse(`<template for={items} as={row}><span>{row.name}</span></template>`);
  const { js } = emit(ir);
  assertStringIncludes(js, "bindFor(");
  assertStringIncludes(js, "items: () => ((values.items) ?? [])");
  assertStringIncludes(js, "render: (item, i) => {");
  assertStringIncludes(js, "const row = item;");
  // Regression: no stale .sync wrapper
  assertEquals(js.includes(".sync"), false);
  // Regression: template-literal brace-eat — braces in expressions preserved
  assertStringIncludes(js, "values.items");
});

Deno.test("row binding avoids render-param shadow inside for-template", () => {
  const ir = parse(`<template for={items} as={row}><span>{row.name}</span></template>`);
  const { js } = emit(ir);
  // Inside render, `row` is the local item param, NOT values.row
  assertStringIncludes(js, "const row = item;");
  // The text expression uses bare `row.name`, not `values.row.name`
  assertStringIncludes(js, "row.name");
  assertEquals(js.includes("values.row.name"), false);
});
