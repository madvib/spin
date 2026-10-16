import { assertEquals } from "@std/assert";
import { expandVariantGroups } from "./expand-groups.ts";

Deno.test("groups expand per variant", () => {
  assertEquals(
    expandVariantGroups("hidden data-[branch]:(inline-flex)"),
    "hidden data-[branch]:inline-flex",
  );
});

Deno.test("multiple items share the prefix", () => {
  assertEquals(
    expandVariantGroups("data-[state=open]:(rotate-90 text-x)"),
    "data-[state=open]:rotate-90 data-[state=open]:text-x",
  );
});

Deno.test("plain utilities pass through", () => {
  assertEquals(expandVariantGroups("flex gap-2"), "flex gap-2");
});
