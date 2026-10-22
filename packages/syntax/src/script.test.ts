import { assertEquals } from "@std/assert";
import { parseScript } from "./script.ts";

Deno.test("a script declares its props and its consumed machine", () => {
  const script = parseScript(`<script>
    props({ items: Item[] = [], disabled: boolean = false });
    consume(slider);
  </script>`);
  assertEquals(script.props, [
    { name: "items", type: "Item[]", default: "[]" },
    { name: "disabled", type: "boolean", default: "false" },
  ]);
  assertEquals(script.consume, ["slider"]);
  assertEquals(script.diagnostics.length, 0);
});

Deno.test("a script with a type and no default", () => {
  const script = parseScript(`<script>props({ label: string });</script>`);
  assertEquals(script.props, [{ name: "label", type: "string" }]);
});

Deno.test("a script that could hold an effect is an error", () => {
  const script = parseScript(`<script>
    const x = compute();
    props({ label: string });
  </script>`);
  assertEquals(script.diagnostics.length, 1);
  assertEquals(script.diagnostics[0]?.code, "script-effect");
});

Deno.test("a script that awaits is an error", () => {
  const script = parseScript(`<script>
    props({ label: string });
    await load();
  </script>`);
  assertEquals(script.diagnostics.length, 1);
});

Deno.test("a script may call both, in any order", () => {
  const script = parseScript(`<script>
    consume(slider);
    props({ label: string });
  </script>`);
  assertEquals(script.consume, ["slider"]);
  assertEquals(script.props.length, 1);
  assertEquals(script.diagnostics.length, 0);
});
