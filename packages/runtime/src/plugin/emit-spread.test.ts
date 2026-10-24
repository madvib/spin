import { test } from "bun:test";
import assert, { deepStrictEqual } from "node:assert/strict";
import { parse } from "@spin/syntax";
import { emit } from "./emit.ts";

test("emit spread produces bindSpread with scopeExpr rewrite", () => {
  const ir = parse(`<div {...tabs.getX(row)}></div>`);
  const { js } = emit(ir);
  assert(js.includes("bindSpread("));
  // A consume name reads through values, exactly like a scope prop.
  const scopeRead = "values.tabs.getX(values.row)";
  assert(js.includes(scopeRead));
});

test("emit for-template produces balanced bindFor without .sync wrapper", () => {
  const ir = parse(
    `<template for={items} as={row}><span>{row.name}</span></template>`,
  );
  const { js } = emit(ir);
  assert(js.includes("bindFor("));
  const itemsFn = "items: () => ((values.items) ?? [])";
  assert(js.includes(itemsFn));
  const renderFn = "render: (item, i) => {";
  assert(js.includes(renderFn));
  assert(js.includes("let row = item;"));
  const updateRow = "update(item) { row = item;";
  assert(js.includes(updateRow));
  deepStrictEqual(js.includes(".sync"), false);
  // Regression: template-literal brace-eat — braces in expressions preserved
  assert(js.includes("values.items"));
});

test("row binding avoids render-param shadow inside for-template", () => {
  const ir = parse(
    `<template for={items} as={row}><span>{row.name}</span></template>`,
  );
  const { js } = emit(ir);
  // Inside render, `row` is the local item param, NOT values.row
  assert(js.includes("let row = item;"));
  const updateRow = "update(item) { row = item;";
  assert(js.includes(updateRow));
  // The text expression uses bare `row.name`, not `values.row.name`
  assert(js.includes("row.name"));
  deepStrictEqual(js.includes("values.row.name"), false);
});

test("object-literal keys survive scopeExpr (carousel index)", () => {
  const ir = parse(
    `<template for={items} as={row}><div {...carousel.getItemProps({ index: i })}></div></template>`,
  );
  const { js } = emit(ir);
  // `index` stays a key, `i` stays the row position — neither becomes values.*
  const itemProps = "getItemProps({ index: i })";
  assert(js.includes(itemProps));
});

test("emit binds an attribute to a typed state read", () => {
  const ir = parse(`<div data-mode={slider.state}></div>`);
  const { js } = emit(ir);
  assert(js.includes(`bindAttr(`));
  assert(js.includes(`"data-mode"`));
  // The consume name reads through values, exactly like a scope prop.
  assert(js.includes("values.slider.state"));
});

test("emit binds a class to a state read", () => {
  const ir = parse(
    `<div class={"bg-surface" + (slider.dragging ? " scale-110" : "")}></div>`,
  );
  const { js } = emit(ir);
  assert(js.includes(`"class"`));
  assert(js.includes("values.slider.dragging"));
});
