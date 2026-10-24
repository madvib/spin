import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { parse } from "./parse.ts";

function textOf(src: string): string {
  const ir = parse(src);
  const node = ir.nodes[0];
  if (!node || node.kind !== "text") throw new Error("expected text node");
  return node.parts
    .filter((p) => p.kind === "static")
    .map((p) => (p.kind === "static" ? p.value : ""))
    .join("");
}

test("parse-entities: named entities decode in static text", () => {
  deepStrictEqual(textOf("a &amp; b"), "a & b");
  deepStrictEqual(textOf("&lt;tag&gt;"), "<tag>");
  deepStrictEqual(textOf("&quot;quoted&quot;"), '"quoted"');
  deepStrictEqual(textOf("&times;"), "\u00d7");
  deepStrictEqual(textOf("&mdash;"), "\u2014");
  deepStrictEqual(textOf("&ndash;"), "\u2013");
  deepStrictEqual(textOf("&hellip;"), "\u2026");
  deepStrictEqual(textOf("&copy;"), "\u00a9");
});

test("parse-entities: decimal numeric refs decode", () => {
  deepStrictEqual(textOf("&#39;"), "'");
  deepStrictEqual(textOf("&#65;"), "A");
  deepStrictEqual(textOf("&#169;"), "\u00a9");
});

test("parse-entities: hex numeric refs decode", () => {
  deepStrictEqual(textOf("&#x27;"), "'");
  deepStrictEqual(textOf("&#x41;"), "A");
  deepStrictEqual(textOf("&#xA9;"), "\u00a9");
  deepStrictEqual(textOf("&#Xa9;"), "\u00a9");
});

test("parse-entities: entities decode in expr-adjacent static segments", () => {
  const ir = parse("a &amp; {x} b &lt; c");
  const node = ir.nodes[0];
  if (!node || node.kind !== "text") throw new Error("expected text node");
  const statics = node.parts.filter((p) => p.kind === "static").map((
    p,
  ) => (p.kind === "static" ? p.value : ""));
  deepStrictEqual(statics, ["a & ", " b < c"]);
  const exprs = node.parts.filter((p) => p.kind === "expr").map((
    p,
  ) => (p.kind === "expr" ? p.expr : ""));
  deepStrictEqual(exprs, ["x"]);
});

test("parse-entities: unknown entities left as-is", () => {
  deepStrictEqual(textOf("&unknown;"), "&unknown;");
  deepStrictEqual(textOf("&amp"), "&amp");
});

test("parse-entities: invalid numeric refs left as-is", () => {
  deepStrictEqual(textOf("&#;"), "&#;");
  deepStrictEqual(textOf("&#x;"), "&#x;");
  deepStrictEqual(textOf("&#99999999;"), "&#99999999;");
});

test("parse-entities: plain text without ampersand unchanged", () => {
  deepStrictEqual(textOf("hello world"), "hello world");
});
