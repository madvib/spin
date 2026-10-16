import { assert, assertEquals } from "@std/assert";
import { parse } from "./parse.ts";
import { emit } from "../plugin/emit.ts";

/**
 * `show={expr}` is structural: it never reaches the DOM, and the element
 * mounts only while the expression holds. The typed contract supplies the
 * condition (`show={treeView.isBranch(row)}`), so styling never re-parses
 * machine state out of `data-*` strings.
 */
Deno.test("show parses to the IR, not to an attribute", () => {
  const ir = parse(`<div><span show={ok}>x</span></div>`);
  const div = ir.nodes[0];
  assert(div !== undefined && div.kind === "element");
  if (div.kind !== "element") return;
  const span = div.children[0];
  assert(span !== undefined && span.kind === "element");
  if (span.kind !== "element") return;
  assertEquals(span.show, "ok");
  assert(
    span.attrs.every((a) => a.name !== "show"),
    "show never reaches the DOM",
  );
});

Deno.test("show emits a bindIf branch, not a hidden toggle", () => {
  const ir = parse(`<div><span show={ok}>x</span></div>`);
  const { js } = emit(ir);
  assert(js.includes("bindIf"), "renders through bindIf");
  assert(!js.includes('setAttribute("show"'), "no show attribute is ever set");
});

Deno.test("static show is a diagnostic, not a silent pass", () => {
  let threw = false;
  try {
    parse(`<div><span show="true">x</span></div>`);
  } catch {
    threw = true;
  }
  assert(threw, "static show fails parse");
});
