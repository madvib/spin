import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { classOf } from "./bind.ts";

test("a class list's string is the classes", () => {
  deepStrictEqual(
    classOf(["mb-4 text-sm", { "text-primary": true }]),
    "mb-4 text-sm text-primary",
  );
});

test("a class object's keys whose value is truthy are in", () => {
  deepStrictEqual(
    classOf({ "bg-surface": true, "bg-primary": false, "p-2": 1 > 0 }),
    "bg-surface p-2",
  );
});

test("a key may name several utilities", () => {
  deepStrictEqual(
    classOf({ "ring-2 ring-border-strong": true }),
    "ring-2 ring-border-strong",
  );
});

test("a class list with nothing truthy is empty", () => {
  deepStrictEqual(classOf(["mb-4", { "text-primary": false }]), "mb-4");
});

test("a plain string is the class", () => {
  deepStrictEqual(classOf("mb-4 text-sm"), "mb-4 text-sm");
});
