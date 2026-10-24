import { assertEquals } from "@std/assert";
import { classOf } from "./bind.ts";

Deno.test("a class list's string is the classes", () => {
  assertEquals(
    classOf(["mb-4 text-sm", { "text-primary": true }]),
    "mb-4 text-sm text-primary",
  );
});

Deno.test("a class object's keys whose value is truthy are in", () => {
  assertEquals(
    classOf({ "bg-surface": true, "bg-primary": false, "p-2": 1 > 0 }),
    "bg-surface p-2",
  );
});

Deno.test("a key may name several utilities", () => {
  assertEquals(
    classOf({ "ring-2 ring-border-strong": true }),
    "ring-2 ring-border-strong",
  );
});

Deno.test("a class list with nothing truthy is empty", () => {
  assertEquals(classOf(["mb-4", { "text-primary": false }]), "mb-4");
});

Deno.test("a plain string is the class", () => {
  assertEquals(classOf("mb-4 text-sm"), "mb-4 text-sm");
});
