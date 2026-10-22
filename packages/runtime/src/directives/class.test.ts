import { assertEquals } from "@std/assert";
import { classOf } from "./bind.ts";

Deno.test("a class object holds the keys whose value is truthy", () => {
  assertEquals(
    classOf({ "bg-surface": true, "bg-primary": false, "p-2": 1 > 0 }),
    "bg-surface p-2",
  );
});

Deno.test("a key may name several utilities", () => {
  assertEquals(classOf({ "ring-2 ring-border-strong": true }), "ring-2 ring-border-strong");
});

Deno.test("a class object with nothing truthy is empty", () => {
  assertEquals(classOf({ "bg-surface": false, "p-2": undefined }), "");
});
