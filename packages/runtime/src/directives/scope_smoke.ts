import { parseScope, coerceProps, ParseError } from "./parse.ts";

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { passed++; console.log(`  ok: ${label}`); }
  else { failed++; console.error(`  FAIL: ${label}`); }
}

function hasDiagnostic(fn: () => void, code: string): boolean {
  try { fn(); return false; }
  catch (e) {
    if (e instanceof ParseError) return e.diagnostics.some((d) => d.code === code);
    throw e;
  }
}

// 1. New props={} form with object-array + consume
console.log("1. new props={} form with object-array + consume");
{
  const src = `<scope>
  props={collapsible: bool = true, items: { value: string, label: string, content: string }[] = [] }
  consume={ accordion }
</scope>`;
  const block = parseScope(src);
  assert(block.props.length === 2, "two props parsed");
  assert(block.props[0]!.name === "collapsible" && block.props[0]!.type === "bool", "collapsible bool");
  assert(block.props[0]!.default === "true", "collapsible default");
  assert(block.props[1]!.name === "items" && block.props[1]!.type === "object-array", "items object-array");
  assert(block.props[1]!.fields?.length === 3, "items has 3 fields");
  assert(block.props[1]!.fields?.[0]?.name === "value" && block.props[1]!.fields?.[0]?.type === "string", "field value:string");
  assert(block.props[1]!.fields?.[1]?.name === "label" && block.props[1]!.fields?.[1]?.type === "string", "field label:string");
  assert(block.props[1]!.fields?.[2]?.name === "content" && block.props[1]!.fields?.[2]?.type === "string", "field content:string");
  assert(block.consume.length === 1 && block.consume[0] === "accordion", "consume accordion");
}

// 2. Old flat props: form rejected
console.log("2. old flat props: form rejected");
{
  const src = `<scope>
  props: collapsible: bool = true, items: string[] = []
</scope>`;
  assert(hasDiagnostic(() => parseScope(src), "scope-props"), "flat form rejected with scope-props");
}

// 3. Coercion: JSON attr string
console.log("3. coercion: JSON attr string");
{
  const src = `<scope>
  props={items: { value: string, count: int }[] = [] }
</scope>`;
  const block = parseScope(src);
  const attrs = { items: '[{"value":"a","count":"3"},{"value":"b","count":"bad"}]' };
  const out = coerceProps(block.props, attrs) as { items: Record<string, unknown>[] };
  assert(Array.isArray(out.items), "items is array");
  assert(out.items.length === 2, "two items kept");
  assert(out.items[0]!.value === "a", "string field as-is");
  assert(out.items[0]!.count === 3, "int field coerced from string");
  assert(out.items[1]!.value === "b", "second item value");
  assert(out.items[1]!.count === undefined, "NaN int falls back to undefined, item kept");
}

// 4. Coercion: property write (object) used as-is
console.log("4. coercion: property write (object) used as-is");
{
  const src = `<scope>
  props={items: { value: string, count: int }[] = [] }
</scope>`;
  const block = parseScope(src);
  const obj = [{ value: "x", count: 5 }, { value: "y", count: 99 }];
  const out = coerceProps(block.props, { items: obj }) as { items: Record<string, unknown>[] };
  assert(out.items === obj, "object used as-is (same reference)");
  assert(out.items[0]!.count === 5, "no field coercion on property write");
}

// 5. Coercion: malformed JSON attr → default
console.log("5. coercion: malformed JSON attr → default");
{
  const src = `<scope>
  props={items: { value: string }[] = [{"value":"default"}] }
</scope>`;
  const block = parseScope(src);
  const out = coerceProps(block.props, { items: "not json" }) as { items: Record<string, unknown>[] };
  assert(Array.isArray(out.items) && out.items.length === 1, "falls back to default");
  assert(out.items[0]!.value === "default", "default value preserved");
}

// 6. Malformed JSON default → scope-default diagnostic
console.log("6. malformed JSON default → scope-default diagnostic");
{
  const src = `<scope>
  props={items: { value: string }[] = [not json] }
</scope>`;
  assert(hasDiagnostic(() => parseScope(src), "scope-default"), "malformed default rejected with scope-default");
}

// 7. Non-object items dropped
console.log("7. non-object items dropped");
{
  const src = `<scope>
  props={items: { value: string }[] = [] }
</scope>`;
  const block = parseScope(src);
  const out = coerceProps(block.props, { items: '[{"value":"ok"}, 42, null, "str"]' }) as { items: Record<string, unknown>[] };
  assert(out.items.length === 1, "non-object items dropped");
  assert(out.items[0]!.value === "ok", "valid item kept");
}

// 8. JSON.stringify(scopeDecls.props) still works (JSON-safe)
console.log("8. JSON.stringify(scopeDecls.props) still works");
{
  const src = `<scope>
  props={items: { value: string, count: int }[] = [{"value":"a","count":1}] }
  consume={ accordion }
</scope>`;
  const block = parseScope(src);
  const json = JSON.stringify(block.props);
  const round = JSON.parse(json);
  assert(round.length === 1, "round-trip length");
  assert(round[0].type === "object-array", "round-trip type");
  assert(round[0].fields.length === 2, "round-trip fields");
  assert(round[0].default === '[{"value":"a","count":1}]', "round-trip default");
}

// 9. Empty scope body
console.log("9. empty scope body");
{
  const block = parseScope(`<scope></scope>`);
  assert(block.props.length === 0 && block.consume.length === 0, "empty scope");
}

// 10. props={} with no consume
console.log("10. props={} with no consume");
{
  const block = parseScope(`<scope> props={ name: string = "hi" } </scope>`);
  assert(block.props.length === 1 && block.consume.length === 0, "props only, no consume");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) Deno.exit(1);
