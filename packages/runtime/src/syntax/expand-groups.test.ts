import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { expandVariantGroups } from "./expand-groups.ts";

test("groups expand per variant", () => {
  deepStrictEqual(
    expandVariantGroups("hidden data-[branch]:(inline-flex)"),
    "hidden data-[branch]:inline-flex",
  );
});

test("multiple items share the prefix", () => {
  deepStrictEqual(
    expandVariantGroups("data-[state=open]:(rotate-90 text-x)"),
    "data-[state=open]:rotate-90 data-[state=open]:text-x",
  );
});

test("plain utilities pass through", () => {
  deepStrictEqual(expandVariantGroups("flex gap-2"), "flex gap-2");
});
