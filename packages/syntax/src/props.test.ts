import { test } from "bun:test";
import { deepStrictEqual } from "node:assert/strict";
import { defaultTwin, resolveTwins } from "./props.ts";

test("the twin of a prop is its default-prefixed name", () => {
  deepStrictEqual(defaultTwin("value"), "defaultValue");
  deepStrictEqual(defaultTwin("count"), "defaultCount");
});

test("a host that wrote the live prop keeps it", () => {
  const resolved = resolveTwins(
    { value: "3", defaultValue: "5" },
    (name) => name === "value",
  );
  deepStrictEqual(resolved["value"], "3");
});

test("a host that wrote only the twin seeds the live prop", () => {
  const resolved = resolveTwins(
    { value: undefined, defaultValue: "5" },
    (name) => name === "defaultValue",
  );
  deepStrictEqual(resolved["value"], "5");
});

test("a declared twin seeds the live prop", () => {
  // The element DECLARED the twin: it is the channel's default.
  const resolved = resolveTwins({ value: "", defaultValue: "5" }, () => false);
  deepStrictEqual(resolved["value"], "5");
});

test("a host that wrote both keeps the live prop", () => {
  const resolved = resolveTwins(
    { value: "3", defaultValue: "5" },
    (name) => name === "value" || name === "defaultValue",
  );
  deepStrictEqual(resolved["value"], "3");
});

test("the twin does not override a prop the host wrote", () => {
  const resolved = resolveTwins(
    { value: "", defaultValue: "5" },
    (name) => name === "value" || name === "defaultValue",
  );
  deepStrictEqual(resolved["value"], "");
});

test("the resolution never mutates the host's bag", () => {
  const bag = { value: undefined, defaultValue: "5" };
  resolveTwins(bag, (name) => name === "defaultValue");
  deepStrictEqual(bag["value"], undefined);
});
