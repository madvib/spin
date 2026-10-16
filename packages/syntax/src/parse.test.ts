import { assertEquals } from "@std/assert";
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

Deno.test("parse-entities: named entities decode in static text", () => {
  assertEquals(textOf("a &amp; b"), "a & b");
  assertEquals(textOf("&lt;tag&gt;"), "<tag>");
  assertEquals(textOf("&quot;quoted&quot;"), '"quoted"');
  assertEquals(textOf("&times;"), "\u00d7");
  assertEquals(textOf("&mdash;"), "\u2014");
  assertEquals(textOf("&ndash;"), "\u2013");
  assertEquals(textOf("&hellip;"), "\u2026");
  assertEquals(textOf("&copy;"), "\u00a9");
});

Deno.test("parse-entities: decimal numeric refs decode", () => {
  assertEquals(textOf("&#39;"), "'");
  assertEquals(textOf("&#65;"), "A");
  assertEquals(textOf("&#169;"), "\u00a9");
});

Deno.test("parse-entities: hex numeric refs decode", () => {
  assertEquals(textOf("&#x27;"), "'");
  assertEquals(textOf("&#x41;"), "A");
  assertEquals(textOf("&#xA9;"), "\u00a9");
  assertEquals(textOf("&#Xa9;"), "\u00a9");
});

Deno.test("parse-entities: entities decode in expr-adjacent static segments", () => {
  const ir = parse("a &amp; {x} b &lt; c");
  const node = ir.nodes[0];
  if (!node || node.kind !== "text") throw new Error("expected text node");
  const statics = node.parts.filter((p) => p.kind === "static").map((p) => (p.kind === "static" ? p.value : ""));
  assertEquals(statics, ["a & ", " b < c"]);
  const exprs = node.parts.filter((p) => p.kind === "expr").map((p) => (p.kind === "expr" ? p.expr : ""));
  assertEquals(exprs, ["x"]);
});

Deno.test("parse-entities: unknown entities left as-is", () => {
  assertEquals(textOf("&unknown;"), "&unknown;");
  assertEquals(textOf("&amp"), "&amp");
});

Deno.test("parse-entities: invalid numeric refs left as-is", () => {
  assertEquals(textOf("&#;"), "&#;");
  assertEquals(textOf("&#x;"), "&#x;");
  assertEquals(textOf("&#99999999;"), "&#99999999;");
});

Deno.test("parse-entities: plain text without ampersand unchanged", () => {
  assertEquals(textOf("hello world"), "hello world");
});
