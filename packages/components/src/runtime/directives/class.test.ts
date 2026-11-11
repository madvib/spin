import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { classOf } from "./bind.ts";

test("a class list's string is the classes", () => {
  deepStrictEqual(
    classOf(["mb-4 text-sm", { "bg-primary": true }]),
    "mb-4 text-sm bg-primary",
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
  deepStrictEqual(classOf("mb-4 bg-primary"), "mb-4 bg-primary");
});

test("a later utility evicts an earlier one in the same family", () => {
  deepStrictEqual(
    classOf(["scale-50 opacity-0", { "scale-100 opacity-100": true }]),
    "scale-100 opacity-100",
  );
});

test("a later fill keeps its ink: the earlier fill loses both", () => {
  deepStrictEqual(
    classOf(["px-2 py-1", { "bg-surface": true, "bg-selected text-on-selected": true }]),
    "px-2 py-1 bg-selected text-on-selected",
  );
});

test("a surface fill evicts the earlier fill and its stranded ink", () => {
  deepStrictEqual(
    classOf(["px-2 py-1", { "bg-selected text-on-selected": true, "bg-surface": true }]),
    "px-2 py-1 bg-surface",
  );
});
